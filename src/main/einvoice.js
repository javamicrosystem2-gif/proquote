// ============================================================
// ProQuote — الفاتورة الإلكترونية (العملية الرئيسية)
// منظومات ضريبية متعددة الدول + ملفات متعددة (Multi-Tenant)
// - الأسرار (Client Secret) مشفّرة بـ safeStorage ولا تعود للواجهة
// - كل الشبكة هنا: فحص الاتصال + التوكِن + تقديم الفواتير + التوقيع
// - سجل آخر 100 عملية للدعم الفني
// ============================================================
'use strict';

const { safeStorage } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const db = require('./db');

// ---------- سجل المنظومات الضريبية ----------
const EI_AUTHORITIES = {
  'eg-eta': {
    id: 'eg-eta', name: 'مصر — منظومة الفاتورة الإلكترونية ETA', short: 'مصر ETA', country: 'EG', flag: '🇪🇬',
    authType: 'client-credentials', custom: false, hasActivityCode: true,
    envs: {
      pre: { authUrl: 'https://id.preprod.eta.gov.eg/connect/token', apiUrl: 'https://api.preprod.eta.gov.eg/api/v1/documentsubmissions' },
      prod: { authUrl: 'https://id.eta.gov.eg/connect/token', apiUrl: 'https://api.invoicing.eta.gov.eg/api/v1.0/documentsubmissions' }
    },
    fields: [
      { k: 'clientId', l: 'Client ID', secret: false },
      { k: 'clientSecret', l: 'Client Secret', secret: true }
    ]
  },
  'generic': {
    id: 'generic', name: 'منظومة أخرى — قالب عام لأي دولة', short: 'منظومة عامة', country: 'ZZ', flag: '🌍',
    authType: 'client-credentials', custom: true, hasActivityCode: false,
    envs: { pre: { authUrl: '', apiUrl: '' }, prod: { authUrl: '', apiUrl: '' } },
    fields: [
      { k: 'clientId', l: 'Client ID / مفتاح المستخدم', secret: false },
      { k: 'clientSecret', l: 'Client Secret / المفتاح السري', secret: true }
    ]
  }
};

const K_PROFILES = 'ei_profiles_v1';
const K_LOGS = 'ei_logs_v1';
const SECRET_MASK = '••••••••';
const TOKEN_TTL_MS = 50 * 60 * 1000; // توكِن صالح لساعة — نجدده قبلها بقليل

// ---------- تشفير الأسرار (DPAPI على ويندوز عبر safeStorage) ----------
function encSecret(plain) {
  if (!plain) return null;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return { v: safeStorage.encryptString(String(plain)).toString('base64'), enc: true };
    }
  } catch (_) {}
  return { v: Buffer.from(String(plain), 'utf8').toString('base64'), enc: false };
}
function decSecret(stored) {
  try {
    if (!stored || !stored.v) return '';
    if (stored.enc) return safeStorage.decryptString(Buffer.from(stored.v, 'base64'));
    return Buffer.from(stored.v, 'base64').toString('utf8');
  } catch (_) { return ''; }
}

// ---------- تخزين الملفات (قاعدة بيانات الشركة — عزل واحتياط تلقائي) ----------
function _profiles() {
  try { return JSON.parse(db.getItem(K_PROFILES) || '[]'); } catch (_) { return []; }
}
function _saveProfiles(list) { db.setItem(K_PROFILES, JSON.stringify(list)); }
function _logs() {
  try { return JSON.parse(db.getItem(K_LOGS) || '[]'); } catch (_) { return []; }
}
function pushLog(action, label, status, message) {
  const logs = _logs();
  logs.unshift({ at: Date.now(), action, label, status, message: String(message || '').slice(0, 500) });
  db.setItem(K_LOGS, JSON.stringify(logs.slice(0, 100)));
}

// ---------- أدوات ----------
function resolveEnv(p) {
  const a = EI_AUTHORITIES[p.authorityId] || EI_AUTHORITIES.generic;
  const env = p.env === 'prod' ? 'prod' : 'pre';
  if (a.custom) {
    const cu = (p.customUrls && p.customUrls[env]) || {};
    return { a, env, authUrl: (cu.authUrl || '').trim(), apiUrl: (cu.apiUrl || '').trim() };
  }
  return { a, env, authUrl: a.envs[env].authUrl, apiUrl: a.envs[env].apiUrl };
}

function creds(p) {
  return {
    clientId: decSecret(p.credsEnc && p.credsEnc.clientId),
    clientSecret: decSecret(p.credsEnc && p.credsEnc.clientSecret)
  };
}

// ---------- HTTP (fetch المدمج — بلا مكتبات خارجية) ----------
async function httpJson(url, opts, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs || 15000);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}
    return { ok: r.ok, status: r.status, text, json };
  } finally { clearTimeout(timer); }
}

// ---------- توكِن (مع كاش في الذاكرة) ----------
const _tokCache = new Map(); // profileId|env → {token, at}

async function getToken(p) {
  const { a, env, authUrl } = resolveEnv(p);
  if (!authUrl) return { error: 'رابط المصادقة غير مضبوط لهذه البيئة' };
  const c = creds(p);
  if (!c.clientId || !c.clientSecret) return { error: 'أكمل Client ID و Client Secret في إعدادات المنظومة' };
  const key = p.id + '|' + env;
  const cached = _tokCache.get(key);
  if (cached && Date.now() - cached.at < TOKEN_TTL_MS) return { token: cached.token };
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: c.clientId, client_secret: c.clientSecret });
  const r = await httpJson(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  }, 12000);
  if (r.ok && r.json && r.json.access_token) {
    _tokCache.set(key, { token: r.json.access_token, at: Date.now() });
    return { token: r.json.access_token };
  }
  if (r.status === 400 || r.status === 401) return { error: 'بيانات الدخول غير صحيحة (HTTP ' + r.status + ')', status: r.status };
  if (r.status === 0 || r.status === null) return { error: 'تعذر الوصول للخادم — تحقق من اتصال الإنترنت' };
  return { error: 'رفض الخادم المصادقة (HTTP ' + r.status + ')' + (r.json && r.json.error ? ' — ' + r.json.error : '') };
}

// ---------- واجهة الوحدة ----------
function listAuthorities() { return Object.values(EI_AUTHORITIES); }

function listProfiles() {
  return _profiles().map(p => ({
    id: p.id, authorityId: p.authorityId, env: p.env, label: p.label,
    taxNumber: p.taxNumber || '', activityCode: p.activityCode || '', signerPath: p.signerPath || '',
    customUrls: p.customUrls || null, isDefault: !!p.isDefault, createdAt: p.createdAt,
    lastTest: p.lastTest || null,
    credsView: {
      clientId: creds(p).clientId,
      clientSecretSet: !!creds(p).clientSecret
    }
  }));
}

function saveProfile(inp) {
  const list = _profiles();
  const id = inp.id || ('eip_' + crypto.randomBytes(6).toString('hex'));
  const old = list.find(x => x.id === id) || null;
  const keepSecret = (k) => {
    const v = (inp.creds && inp.creds[k]) || '';
    if (v === SECRET_MASK || v === '') return old && old.credsEnc ? old.credsEnc[k] : null;
    return encSecret(v);
  };
  const p = {
    id,
    authorityId: EI_AUTHORITIES[inp.authorityId] ? inp.authorityId : 'generic',
    env: inp.env === 'prod' ? 'prod' : 'pre',
    label: String(inp.label || '').trim() || 'ملف منظومة',
    taxNumber: String(inp.taxNumber || '').trim(),
    activityCode: String(inp.activityCode || '').trim(),
    signerPath: String(inp.signerPath || '').trim(),
    customUrls: inp.customUrls || (old ? old.customUrls : null) || null,
    credsEnc: { clientId: keepSecret('clientId'), clientSecret: keepSecret('clientSecret') },
    isDefault: old ? old.isDefault : list.length === 0,
    createdAt: old ? old.createdAt : Date.now(),
    lastTest: old ? old.lastTest : null
  };
  const i = list.findIndex(x => x.id === id);
  if (i >= 0) list[i] = p; else list.push(p);
  _tokCache.delete(id + '|' + p.env); // بيانات جديدة — توكِن جديد
  _saveProfiles(list);
  pushLog('حفظ ملف', p.label, 'ok', (i >= 0 ? 'حُدّث' : 'أُنشئ') + ' — ' + (EI_AUTHORITIES[p.authorityId] || {}).short + ' (' + (p.env === 'prod' ? 'فعلي' : 'تجريبي') + ')');
  return { id: p.id, count: list.length };
}

function deleteProfile(id) {
  const list = _profiles().filter(x => x.id !== id);
  if (list.length && !list.some(x => x.isDefault)) list[0].isDefault = true;
  _saveProfiles(list);
  pushLog('حذف ملف', 'ملف', 'ok', 'حُذف الملف ' + id.slice(0, 10));
  return { count: list.length };
}

function setDefaultProfile(id) {
  const list = _profiles();
  list.forEach(p => { p.isDefault = (p.id === id); });
  _saveProfiles(list);
  return { ok: true };
}

function defaultProfile() { return _profiles().find(p => p.isDefault) || _profiles()[0] || null; }

// ترحيل الإعدادات القديمة (مصر بملف واحد) إلى نظام الملفات المتعددة — بلا فقد
function migrateLegacy(legacyCfg) {
  if (!legacyCfg || !legacyCfg.clientId) return { migrated: false };
  if (_profiles().length) return { migrated: false };
  saveProfile({
    authorityId: 'eg-eta',
    env: legacyCfg.env === 'prod' ? 'prod' : 'pre',
    label: 'مصر — إعدادات قديمة',
    activityCode: legacyCfg.act || '',
    signerPath: legacyCfg.signer || '',
    creds: { clientId: legacyCfg.clientId, clientSecret: legacyCfg.clientSecret }
  });
  pushLog('ترحيل', 'مصر — إعدادات قديمة', 'ok', 'نُقلت إعدادات ETA القديمة إلى ملف منظومة');
  return { migrated: true };
}

// ---------- فحص الاتصال (يُنفَّذ هنا لتجاوز حظر CORS وبقاء الأسرار بالخلفية) ----------
async function testConnection(id) {
  const list = _profiles();
  const p = list.find(x => x.id === id) || defaultProfile();
  if (!p) return { status: 'unconfigured', message: 'لا يوجد ملف منظومة — أضف واحداً من «ربط الضرائب»' };
  const t0 = Date.now();
  const r = await getToken(p);
  const latencyMs = Date.now() - t0;
  const label = p.label + ' — ' + (EI_AUTHORITIES[p.authorityId] || {}).short + ' (' + (p.env === 'prod' ? 'فعلي' : 'تجريبي') + ')';
  let out;
  if (r.token) {
    out = { status: 'connected', message: 'متصل بالمنظومة بنجاح', latencyMs, profileId: p.id, label: p.label };
    pushLog('فحص اتصال', label, 'connected', 'نجح خلال ' + latencyMs + 'ms');
  } else {
    out = { status: 'disconnected', message: r.error || 'تعذر الاتصال', latencyMs, profileId: p.id, label: p.label };
    pushLog('فحص اتصال', label, 'disconnected', out.message);
  }
  p.lastTest = { status: out.status, message: out.message, latencyMs, at: Date.now() };
  _saveProfiles(list);
  return out;
}

// ---------- حالة الموقّع الخارجي (توكن USB) ----------
function signerStatus(id) {
  const p = (id && _profiles().find(x => x.id === id)) || defaultProfile();
  if (!p) return { configured: false, exists: false, path: '', message: 'لا يوجد ملف منظومة' };
  const sp = p.signerPath || '';
  if (!sp) return { configured: false, exists: false, path: '', message: 'غير مطلوب — الفواتير تُحفظ محلياً بتوقيع مؤقت' };
  let exists = false;
  try { exists = fs.existsSync(sp); } catch (_) {}
  return {
    configured: true, exists, path: sp,
    message: exists ? 'الموقّع جاهز للتوقيع' : 'مسار الموقّع غير موجود على الجهاز — تحقق من تثبيت أداة التوقيع'
  };
}

// ---------- التوقيع عبر أداة خارجية (نفس منطق ei:sign القديم) ----------
function signDoc(signerPath, docStr) {
  return new Promise((resolve) => {
    try {
      const tmp = path.join(os.tmpdir(), 'pq_ei_' + Date.now() + '.json');
      fs.writeFileSync(tmp, docStr, 'utf8');
      execFile(signerPath, [tmp], { timeout: 30000 }, (err, stdout) => {
        try { fs.unlinkSync(tmp); } catch (_) {}
        if (err) resolve({ ok: false, error: err.message }); else resolve({ ok: true, out: stdout });
      });
    } catch (e) { resolve({ ok: false, error: e.message }); }
  });
}

// ---------- تقديم الفاتورة (توكن + توقيع + إرسال — كله هنا) ----------
async function submitInvoice(profileId, doc) {
  const list = _profiles();
  const p = list.find(x => x.id === profileId) || defaultProfile();
  if (!p) return { ok: false, error: 'لا يوجد ملف منظومة — اضبط الربط أولاً من «ربط الضرائب»' };
  const { apiUrl } = resolveEnv(p);
  const label = p.label + ' — ' + (EI_AUTHORITIES[p.authorityId] || {}).short + ' (' + (p.env === 'prod' ? 'فعلي' : 'تجريبي') + ')';

  const t0 = Date.now();
  const tk = await getToken(p);
  if (!tk.token) {
    pushLog('إرسال فاتورة', label, 'rejected', 'فشل المصادقة: ' + tk.error);
    return { ok: false, error: tk.error };
  }

  // التوقيع: أداة خارجية إن ضُبطت، وإلا توقيع محلي مؤقت (الفاتورة تُحفظ «غير مُقدمة» عند الرفض)
  let docStr = JSON.stringify(doc);
  let signature = { signatureType: 'I', value: 'LOCAL-UNSIGNED-' + Date.now() };
  if (p.signerPath) {
    const sg = await signDoc(p.signerPath, docStr);
    if (sg.ok && sg.out) {
      try { signature = JSON.parse(sg.out); } catch (_) { signature = { signatureType: 'I', value: String(sg.out).trim() }; }
    } else {
      pushLog('توقيع', label, 'rejected', 'فشل الموقّع: ' + (sg.error || ''));
      return { ok: false, error: 'فشل أداة التوقيع: ' + (sg.error || '') };
    }
  }
  const signedDoc = { ...doc, signatures: [signature] };

  if (!apiUrl) {
    pushLog('إرسال فاتورة', label, 'rejected', 'رابط الـ API غير مضبوط لهذه البيئة');
    return { ok: false, error: 'رابط الـ API غير مضبوط لهذه البيئة' };
  }

  const r = await httpJson(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk.token },
    body: JSON.stringify({ documents: [signedDoc] })
  }, 30000);
  const latencyMs = Date.now() - t0;

  if (r.ok && r.json && r.json.submissionId) {
    const rejected = (r.json.rejectedDocuments || []);
    if (!rejected.length) {
      const uuid = (r.json.acceptedDocuments && r.json.acceptedDocuments[0] && r.json.acceptedDocuments[0].uuid) || '';
      pushLog('إرسال فاتورة', label, 'accepted', 'قُبلت — ' + r.json.submissionId + ' خلال ' + latencyMs + 'ms');
      return { ok: true, status: 'accepted', submissionId: r.json.submissionId, uuid, message: 'قُبلت الفاتورة من المنظومة' };
    }
    // صيغتا ETA: rejectedDocuments[].errors[].message أو error.details[].message
    const em = ((rejected[0].errors || (rejected[0].error && rejected[0].error.details) || [])).map(e => e.message || e.code).filter(Boolean).join(' | ') || 'رفضت المنظومة المستند';
    pushLog('إرسال فاتورة', label, 'rejected', em);
    return { ok: true, status: 'rejected', submissionId: r.json.submissionId, message: em };
  }
  if (r.status === 400 || r.status === 401) {
    pushLog('إرسال فاتورة', label, 'rejected', 'رفض الخادم (HTTP ' + r.status + ')');
    return { ok: true, status: 'rejected', submissionId: null, message: 'رفض الخادم الطلب (HTTP ' + r.status + ') — تحقق من بيانات الربط' };
  }
  const em = r.json ? (r.text || '').slice(0, 300) : 'تعذر الوصول للخادم — تحقق من الإنترنت';
  pushLog('إرسال فاتورة', label, 'rejected', em);
  return { ok: false, error: em };
}

function logs() { return _logs(); }

module.exports = {
  listAuthorities, listProfiles, saveProfile, deleteProfile, setDefaultProfile,
  migrateLegacy, testConnection, signerStatus, submitInvoice, logs,
  SECRET_MASK, EI_AUTHORITIES
};
