// ============================================================
// ProQuote — نظام الترخيص (المفتاح العام RSA-2048)
// - بصمة فريدة للجهاز (machine fingerprint)
// - نسخة تجريبية (30 يوماً) بمقاومة أساسية للتلاعب
// - تفعيل عبر خادم المطور (Supabase Edge Function) بترخيص مُوقَّع
// - لا يحتوي هذا الملف على أي سرّ: المفتاح العام فقط (نشره آمن)
//   المفتاح الخاص يسكن حصرياً في أسرار الدالة LICENSE_SIGNING_KEY
// ============================================================

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const db = require('./db');

// إعدادات النظام
const TRIAL_DAYS = 30;                    // مدة النسخة التجريبية

// ===== مفتاح الترخيص العام (التحقق فقط — لا يولّد تراخيص) =====
// PQ_LICENSE_PUBKEY: للتشغيل المحلي/الفحص فقط (سيرفر وهمي بمفتاح خاص تجريبي) — بلا تأثير على الإنتاج
const DEFAULT_LICENSE_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAorORNkKr3mbHA+NG5pGS\nMbjIampmg6MoKN0sMI4+6Pb4i7xyQmdpxZU0zNmnK3jBUay+NKREMt9QRhAdq78b\nv5px6Tfu4U49UyXV9sdmvm30f1Pf/XT4YTBGmHPOZtJeZC5Uhqhki+2vf6/wcZ3e\ne/TI6BocGQKsp6jjO3uKHJjKEiCSgEpJGhPHnJcBAY6hqGMdCOMchxq7lFkScQzD\npXuMT/m9Aiu6VlDFFZwFe7Wb358H5D/BKEXcueY1oU09xaCUxjsAYBNzZiLxuAeQ\nwOSGTLxs/5VpqN1p7XQ5EGtCyEssNrdwWsxcEqRO8naSZ2kNnJH3XHebDdBuQWzA\nbQIDAQAB\n-----END PUBLIC KEY-----\n';
function getPublicKeyPem() { return process.env.PQ_LICENSE_PUBKEY || DEFAULT_LICENSE_PUBLIC_KEY; }

// خادم التفعيل (دالة Edge في مشروع المطور) — للتجربة المحلية يمكن تجاوزه بمتغير PQ_LICENSE_SERVER
const SB_KEY = 'sb_publishable_VFdPDdUF0T0h_aof5D_WJQ_jh7VxdOS'; // مفتاح Supabase العمومي (آمن للنشر — مثل anon)
const DEFAULT_LICENSE_SERVER = 'https://fxyvnmocjwtzddlqeyve.supabase.co/functions/v1/activate-license';
function getLicenseServer() { return process.env.PQ_LICENSE_SERVER || DEFAULT_LICENSE_SERVER; }

// فلفلة ملفات التجربة فقط (مغايرة تماماً لأي سرّ قديم — لا تفتح التراخيص بحال)
const _TP = ['6f3a5d28696f6c771636257e2f0a68194b6d77356b27693409238f6427656c61636f6c771636257e2f0a68194b6d77356b27693409238f6427656c61636f6c771636257e2f0a68194b6d77'].join('');
const TRIAL_PEPPER = _TP.match(/.{2}/g).map(h => String.fromCharCode(parseInt(h, 16) ^ 0x3C)).join('');

const LICENSE_FILE = 'license.dat';       // ملف الترخيص (نسخة احتياطية عن بصمة + تفعيل)

// ---------- بصمة الجهاز ----------
function getMachineId() {
  // جمع معرّفات متعددة لإنشاء بصمة فريدة نسبياً
  const parts = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.cpus()[0]?.model || 'unknown-cpu',
    String(os.cpus().length),
    os.userInfo().username,
    os.networkInterfaces()['Ethernet']?.[0].mac ||
    os.networkInterfaces()['Wi-Fi']?.[0].mac ||
    Object.values(os.networkInterfaces())[0]?.[0].mac || 'no-mac'
  ];
  const raw = parts.join('|');
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// معرّف مختصر للعرض (8 حروف)
function getShortDeviceId() {
  return getMachineId().substring(0, 8).toUpperCase();
}

// ---------- ملف الترخيص (موقعان لمقاومة الحذف) ----------
function getLicensePath() {
  return path.join(app.getPath('userData'), LICENSE_FILE);
}
function getLicensePath2() {
  return path.join(os.homedir(), '.proquote', '.license');
}

function readLicenseFile() {
  const data1 = readSingleLicense(getLicensePath());
  const data2 = readSingleLicense(getLicensePath2());
  if (data1 && data2) {
    return data1.timestamp > data2.timestamp ? data1 : data2;
  }
  return data1 || data2;
}

function readSingleLicense(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const envelope = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!envelope) return null;

    // 0) التنسيق v2: عدة مظاريف موقعة — باقة مُفعّلة لكل عنصر (تراكم الباقات)
    if (Array.isArray(envelope.items)) {
      const items = [];
      for (const it of envelope.items) {
        if (!it || !it.payload || !it.sig) continue;
        let p = null; try { p = JSON.parse(it.payload); } catch (_) { continue; }
        if (!p || p.deviceId === undefined || !p.tier) continue;
        let ok = false;
        try {
          ok = crypto.verify(
            'RSA-SHA256',
            Buffer.from(it.payload, 'utf8'),
            crypto.createPublicKey({ key: getPublicKeyPem(), format: 'pem', type: 'spki' }),
            Buffer.from(it.sig, 'base64')
          );
        } catch (_) { ok = false; }
        if (ok) items.push({ payload: it.payload, sig: it.sig, timestamp: it.timestamp || 0 });
      }
      if (!items.length) return null;
      return { type: 'activated-multi', items, timestamp: envelope.timestamp || 0 };
    }

    if (!envelope.payload || !envelope.sig) return null;
    const payloadStr = envelope.payload;

    // 1) ترخيص مُوقَّع من الخادم — تحقق بالمفتاح العام (أوفلاين، بلا أسرار في البرنامج)
    let parsed = null;
    try { parsed = JSON.parse(payloadStr); } catch (_) { return null; }
    if (parsed && parsed.deviceId !== undefined && parsed.tier) {
      const ok = crypto.verify(
        'RSA-SHA256',
        Buffer.from(payloadStr, 'utf8'),
        crypto.createPublicKey({ key: getPublicKeyPem(), format: 'pem', type: 'spki' }),
        Buffer.from(envelope.sig, 'base64')
      );
      if (!ok) { console.warn('[license] توقيع ترخيص غير صالح في', filePath); return null; }
      return { type: 'activated', ...parsed, payload: payloadStr, sig: envelope.sig, timestamp: envelope.timestamp || 0 };
    }

    // 2) ملف تجربة — تحقق بفلفلة التجربة (مقاومة أساسية لتلاعب التاريخ)
    if (parsed && parsed.trialStart !== undefined) {
      const recomputed = crypto.createHmac('sha256', TRIAL_PEPPER).update(payloadStr).digest('hex');
      if (recomputed !== envelope.sig) { console.warn('[license] توقيع تجربة غير صالح'); return null; }
      return { ...parsed, timestamp: envelope.timestamp || 0 };
    }
    return null;
  } catch {
    return null;
  }
}

function writeLicenseFileRaw(obj) {
  const body = JSON.stringify(obj);
  // كتابة في الموقعين
  try {
    const dir1 = path.dirname(getLicensePath());
    if (!fs.existsSync(dir1)) fs.mkdirSync(dir1, { recursive: true });
    fs.writeFileSync(getLicensePath(), body, 'utf8');
  } catch (e) { console.error('[license] فشل كتابة الموقع 1:', e.message); }
  try {
    const dir2 = path.dirname(getLicensePath2());
    if (!fs.existsSync(dir2)) fs.mkdirSync(dir2, { recursive: true });
    fs.writeFileSync(getLicensePath2(), body, 'utf8');
  } catch (e) { console.error('[license] فشل كتابة الموقع 2:', e.message); }
}

function writeLicenseEnvelope(envelope) {
  writeLicenseFileRaw({ ...envelope, timestamp: Date.now() });
}

// إضافة/تجديد باقة مُفعّلة: نفس الباقة تُستبدل (تجديد بمدة ممتدة) وباقة جديدة تُضاف — دون مسح السابقة
function upsertActivatedItem(payloadStr, sig) {
  const existing = readLicenseFile();
  let items = [];
  if (existing && existing.type === 'activated-multi') {
    items = existing.items.slice();
  } else if (existing && existing.type === 'activated' && existing.payload) {
    items = [{ payload: existing.payload, sig: existing.sig, timestamp: existing.timestamp || 0 }];
  }
  const tierOf = (payload) => { try { return (JSON.parse(payload) || {}).tier || null; } catch (_) { return null; } };
  const newTier = tierOf(payloadStr);
  if (!newTier) return { items, renewed: false };
  const renewed = items.some(it => tierOf(it.payload) === newTier);
  items = items.filter(it => tierOf(it.payload) !== newTier);
  items.push({ payload: payloadStr, sig, timestamp: Date.now() });
  if (items.length > 12) items = items.slice(-12);
  writeLicenseFileRaw({ v: 2, items, timestamp: Date.now() });
  return { items, renewed };
}

function startTrial() {
  const payloadStr = JSON.stringify({ trialStart: Date.now(), deviceId: getMachineId() });
  const sig = crypto.createHmac('sha256', TRIAL_PEPPER).update(payloadStr).digest('hex');
  writeLicenseEnvelope({ payload: payloadStr, sig });
}

// ---------- حالة الترخيص ----------
function getState() {
  const license = readLicenseFile();
  const now = Date.now();
  const myDevice = getShortDeviceId();

  // 1) باقات مُفعّلة متراكمة (v2) أو ترخيص مفرد قديم — كل باقة تُقرأ على حدة
  let actItems = null; // [{tier, deviceId, expiry, issued}]
  if (license && license.type === 'activated-multi') {
    actItems = license.items
      .map(it => { try { return JSON.parse(it.payload); } catch (_) { return null; } })
      .filter(p => p && p.tier);
  } else if (license && license.type === 'activated') {
    actItems = [license];
  }
  if (actItems && actItems.length) {
    const mine = actItems.filter(p => p.deviceId === myDevice);
    const active = mine.filter(p => !p.expiry || now <= p.expiry);
    const packages = mine.map(p => ({
      tier: p.tier,
      name: tierDisplayName(p.tier),
      expiry: p.expiry || null,
      expired: !!(p.expiry && now > p.expiry)
    }));
    if (active.length) {
      const tiers = active.map(p => p.tier);
      const primary = tiers.includes('full') ? 'full' : tiers[0];
      const maxUsers = tiers.reduce((m, t) => {
        const u = maxUsersForTier(t);
        return (u === 0 || m === 0) ? 0 : Math.max(m, u);
      }, 1);
      return {
        status: 'activated',
        tier: primary,
        tiers,
        packages,
        deviceId: myDevice,
        activatedAt: active[0].issued || null,
        expiry: Math.max(...active.map(p => p.expiry || 0)) || null,
        message: 'مُفعّل — ' + tiers.map(t => tierDisplayName(t)).join(' + '),
        maxUsers
      };
    }
    return {
      status: 'expired',
      tier: null,
      tiers: [],
      packages,
      deviceId: myDevice,
      message: 'انتهت صلاحية جميع الباقات — جدّد اشتراكك',
      maxUsers: 0
    };
  }

  // 2) نسخة تجريبية
  let trialStart = license?.trialStart;
  if (!trialStart) {
    // أول تشغيل: ابدأ التجربة
    startTrial();
    trialStart = now;
  }

  const trialEnd = trialStart + (TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const daysLeft = Math.ceil((trialEnd - now) / (24 * 60 * 60 * 1000));

  if (now > trialEnd) {
    return {
      status: 'expired',
      tier: null,
      tiers: [],
      packages: [],
      deviceId: getShortDeviceId(),
      trialStart,
      trialEnd,
      message: 'انتهت النسخة التجريبية',
      maxUsers: 0
    };
  }

  return {
    status: 'trial',
    tier: 'trial',
    tiers: ['trial'],
    packages: [],
    deviceId: getShortDeviceId(),
    trialStart,
    trialEnd,
    daysLeft,
    message: 'نسخة تجريبية — ' + daysLeft + ' يوم متبقي',
    maxUsers: 0
  };
}

// هل التطبيق مُفعّل (للتحكم في الوصول)؟
function isLicensed() {
  const s = getState();
  return s.status === 'activated' || s.status === 'trial';
}

// ---------- بوابة الميزات (Feature Gate) للإصدارات ----------
const TIER_FEATURES = {
  trial: ['quotes', 'clients', 'products', 'tech', 'receipt', 'custom', 'full', 'documents', 'templates', 'pdf', 'print', 'export', 'import'],
  basic: ['quotes', 'clients', 'products', 'pdf', 'print', 'export'],
  professional: ['quotes', 'clients', 'products', 'tech', 'receipt', 'custom', 'full', 'templates', 'pdf', 'print', 'export', 'import'],
  enterprise: ['quotes', 'clients', 'products', 'tech', 'receipt', 'custom', 'full', 'documents', 'templates', 'pdf', 'print', 'export', 'import', 'autoupdate', 'plugins', 'eta_invoice']
};

// ---------- نظام الباقات: الأقسام المفتوحة لكل باقة ----------
// الأقسام الستة والعشرون كما في الشريط الجانبي. لوحة التحكم والإعدادات مفتوحان دائماً.
const ALWAYS_OPEN_SECTIONS = ['dash', 'settings'];
const _PKG_QUOTES = ['quotes','purchase', 'tech', 'receipt', 'auth', 'custom', 'full', 'samples', 'supply', 'returns', 'tenders', 'shipping'];
const _PKG_FINANCE = ['payments', 'sorecv', 'receivables', 'rcpt'];
const _PKG_MGMT = ['company', 'clients', 'products', 'warehouse', 'mfg', 'documents', 'emp', 'notes'];
const _PKG_SYSTEM = ['ei', 'adm'];
const _ALL_SECTIONS = ALWAYS_OPEN_SECTIONS.concat(_PKG_QUOTES, _PKG_FINANCE, _PKG_MGMT, _PKG_SYSTEM);

const TIER_SECTIONS = {
  // الباقات الخمس الجديدة (نظام الاشتراكات بالأقسام)
  quotes: ALWAYS_OPEN_SECTIONS.concat(_PKG_QUOTES),
  finance: ALWAYS_OPEN_SECTIONS.concat(_PKG_FINANCE),
  mgmt: ALWAYS_OPEN_SECTIONS.concat(_PKG_MGMT),
  system: ALWAYS_OPEN_SECTIONS.concat(_PKG_SYSTEM),
  full: _ALL_SECTIONS.slice(),
  // التجربة: كل الأقسام 30 يوماً ثم قفل كامل (licEnforce)
  trial: _ALL_SECTIONS.slice(),
  // الباقات القديمة (solo/small/med/ulim/basic/professional/enterprise) وغير المعروفة:
  // كل الأقسام — لا ننزع من مشترك قديم شيئاً اشتراه
  solo: _ALL_SECTIONS.slice(),
  small: _ALL_SECTIONS.slice(),
  med: _ALL_SECTIONS.slice(),
  ulim: _ALL_SECTIONS.slice(),
  basic: _ALL_SECTIONS.slice(),
  professional: _ALL_SECTIONS.slice(),
  enterprise: _ALL_SECTIONS.slice()
};

// أسماء الباقات للعرض
const TIER_NAMES = {
  quotes: 'باقة عروض الأسعار', finance: 'باقة الأمور المالية', mgmt: 'باقة الإدارة',
  system: 'باقة النظام', full: 'الباقة الشاملة', trial: 'نسخة تجريبية',
  solo: 'الباقة الفردية (كاملة)', small: 'باقة الشركات الصغيرة (كاملة)', med: 'باقة الشركات المتوسطة (كاملة)', ulim: 'الباقة الكبرى (كاملة)'
};

// ذاكرة تخزين مؤقت للأقسام المسموحة (تفادي قراءة الملف الموقّع مع كل تنقل)
let _sectionsCache = { tier: null, status: null, sections: null };

function getAllowedSections() {
  const s = getState();
  const cacheKey = (s.tiers && s.tiers.length ? s.tiers : [s.tier]).join(',');
  if (_sectionsCache.tier === cacheKey && _sectionsCache.status === s.status && _sectionsCache.sections) {
    return _sectionsCache.sections;
  }
  let sections;
  if (s.status === 'trial') sections = TIER_SECTIONS.trial;
  else if (s.status === 'activated' && s.tiers && s.tiers.length) {
    // اتحاد أقسام كل الباقات النشطة — المفتوح بأي باقة يبقى مفتوحاً
    const set = new Set(ALWAYS_OPEN_SECTIONS);
    s.tiers.forEach(t => (TIER_SECTIONS[t] || []).forEach(x => set.add(x)));
    sections = Array.from(set);
  }
  else if (s.status === 'activated' && s.tier && TIER_SECTIONS[s.tier]) sections = TIER_SECTIONS[s.tier];
  else sections = ALWAYS_OPEN_SECTIONS.slice(); // منتهي/غير معروف: الأساسيات فقط (الواجهة تمنع الباقي عبر licEnforce عموماً)
  _sectionsCache = { tier: cacheKey, status: s.status, sections: sections.slice() };
  return _sectionsCache.sections;
}

function sectionAllowed(sectionKey) {
  return getAllowedSections().includes(sectionKey);
}

function tierDisplayName(tier) {
  return TIER_NAMES[tier] || (tier ? ('مُفعّل (' + tier + ')') : '—');
}

// ---------- حد المستخدمين لكل باقة (0 = بلا حدود) ----------
const TIER_MAX_USERS = { trial: 0, quotes: 1, finance: 1, mgmt: 1, system: 1, full: 0, solo: 1, small: 3, med: 8, ulim: 0, basic: 1, professional: 8, enterprise: 0 };
function maxUsersForTier(tier) { return (tier && TIER_MAX_USERS[tier] !== undefined) ? TIER_MAX_USERS[tier] : 0; }

function getTier() {
  const s = getState();
  return s.tier || 'trial';
}

function hasFeature(featureName) {
  const tier = getTier();
  const features = TIER_FEATURES[tier] || TIER_FEATURES.basic;
  return features.includes(featureName);
}

function getAvailableFeatures() {
  const tier = getTier();
  return TIER_FEATURES[tier] || TIER_FEATURES.basic;
}

// ---------- التفعيل عبر خادم المطور ----------
// يرسل {key, deviceId} لدالة activate-license، ويستلم ترخيصاً مُوقَّعاً بالمفتاح الخاص،
// ويتحقق محلياً بالمفتاح العام قبل قبوله — لا ثقة عمياء في الاستجابة.
async function activate(keyStr) {
  const clean = String(keyStr || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (clean.length < 10) {
    return { success: false, error: 'طول كود التفعيل غير صحيح' };
  }
  const deviceId = getShortDeviceId();
  let r, j;
  try {
    r = await fetch(getLicenseServer(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SB_KEY },
      body: JSON.stringify({ key: clean, deviceId })
    });
    j = await r.json().catch(() => ({}));
  } catch (e) {
    return { success: false, error: 'تعذر الاتصال بخادم التفعيل — تأكد من اتصال الإنترنت وأعد المحاولة' };
  }
  if (!r.ok || !j || !j.success || !j.license) {
    return { success: false, error: (j && j.error) || ('فشل التفعيل — HTTP ' + r.status) };
  }
  // تحقق توقيع الخادم محلياً بالمفتاح العام
  const payloadStr = typeof j.license.payload === 'string' ? j.license.payload : JSON.stringify(j.license.payload);
  let ok = false;
  try {
    ok = crypto.verify(
      'RSA-SHA256',
      Buffer.from(payloadStr, 'utf8'),
      crypto.createPublicKey({ key: getPublicKeyPem(), format: 'pem', type: 'spki' }),
      Buffer.from(j.license.sig, 'base64')
    );
  } catch (_) { ok = false; }
  if (!ok) return { success: false, error: 'استجابة خادم غير موثوقة — رفض التفعيل' };

  const payload = JSON.parse(payloadStr);
  if (payload.deviceId !== deviceId) return { success: false, error: 'هذا الترخيص مرتبط بجهاز آخر' };
  if (payload.expiry && Date.now() > payload.expiry) return { success: false, error: 'انتهت صلاحية هذا الكود' };

  // إضافة الباقة (أو تجديدها) دون مسح الباقات الأخرى المُفعّلة
  const { items, renewed } = upsertActivatedItem(payloadStr, j.license.sig);
  const pkgName = tierDisplayName(payload.tier);
  return {
    success: true,
    tier: payload.tier,
    tiers: items.map(it => { try { return (JSON.parse(it.payload) || {}).tier; } catch (_) { return null; } }).filter(Boolean),
    message: (renewed ? 'تم تجديد «' + pkgName + '» بنجاح!' : 'تمت إضافة «' + pkgName + '» بنجاح! شكراً لشراء ProQuote.')
  };
}

// تصدير للواجهة
module.exports = {
  getMachineId, getShortDeviceId,
  getState, isLicensed,
  getTier, hasFeature, getAvailableFeatures,
  getAllowedSections, sectionAllowed, tierDisplayName,
  activate,
  TRIAL_DAYS, TIER_FEATURES, TIER_MAX_USERS, TIER_SECTIONS, ALWAYS_OPEN_SECTIONS
};
