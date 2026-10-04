#!/usr/bin/env node
// ============================================================
// ProQuote Sync Server v2.0 — خادم مزامنة يعمل على أي هوست
// بلا أي مكتبات خارجية (Node.js فقط)
// متوافق مع نداءات التطبيق (نفس بروتوكول Supabase/PostgREST الفرعي):
//   GET  /rest/v1/pq_state?select=key,val
//   GET  /rest/v1/pq_state?key=eq.pq5_usr&select=val
//   POST /rest/v1/pq_state  (Prefer: resolution=merge-duplicates)
//   GET/POST /rest/v1/pq_plans  (upsert حسب plan_key)
// ونفس المسارات تحت /api/... أيضاً
//
// التشغيل: node sync-server.js
// أو: PORT=3000 API_KEY=mysecret node sync-server.js
//
// في البرنامج: الإعدادات ← المزامنة ← رابط الخادم ←
//   http://your-server:3000   (بدون /rest/v1 — يُضاف تلقائياً)
//   والمفتاح: نفس API_KEY
// ============================================================

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3000', 10);
const API_KEY = process.env.API_KEY || 'proquote-sync-key';
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'sync-data.json');
const MAX_BODY = 50 * 1024 * 1024; // 50MB

// الجداول المدعومة ومفتاحها الأساسي
const TABLES = {
  pq_state: 'key',
  pq_plans: 'plan_key',
};

// ---------- تخزين (لكل جدول قسمه) ----------
let store = { pq_state: {}, pq_plans: {} };
function loadStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (raw && raw.pq_state) {
        store = { pq_state: raw.pq_state || {}, pq_plans: raw.pq_plans || {} };
      } else if (raw && typeof raw === 'object') {
        // ترحيل الصيغة القديمة (مسطّحة) → pq_state
        store = { pq_state: raw, pq_plans: {} };
      }
    }
  } catch (e) { console.error('[store] تحميل:', e.message); }
}
function saveStore() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store), 'utf8');
  } catch (e) { console.error('[store] حفظ:', e.message); }
}
loadStore();

// ---------- أدوات ----------
function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, Prefer, x-api-key',
  });
  res.end(body);
}
function checkAuth(req, url) {
  const auth = req.headers['authorization'] || '';
  const apikey = req.headers['apikey'] || req.headers['x-api-key'] || '';
  const urlKey = url.searchParams.get('apikey') || '';
  const token = auth.replace(/^Bearer\s+/i, '') || apikey || urlKey;
  return token === API_KEY;
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) { reject(new Error('payload too large')); req.destroy(); return; }
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
// فلترة بأسلوب PostgREST الفرعي الذي يستخدمه التطبيق: key=eq.VALUE
function parseEqFilter(url, col) {
  const v = url.searchParams.get(col);
  if (typeof v === 'string' && v.indexOf('eq.') === 0) return v.slice(3);
  return null;
}
// إسقاط أعمدة select=a,b
function project(row, select) {
  if (!select) return row;
  const cols = select.split(',').map(s => s.trim()).filter(Boolean);
  const out = {};
  cols.forEach(c => { if (row[c] !== undefined) out[c] = row[c]; });
  return out;
}

// ---------- المعالج ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, Prefer, x-api-key',
    });
    return res.end();
  }

  // صفحة معلومات
  if (pathname === '/' || pathname === '/info') {
    return json(res, 200, {
      name: 'ProQuote Sync Server',
      version: '2.0.0',
      status: 'running',
      endpoints: {
        'GET /rest/v1/pq_state?select=key,val': 'جلب كل المفاتيح',
        'GET /rest/v1/pq_state?key=eq.pq5_usr&select=val': 'جلب مفتاح محدد',
        'POST /rest/v1/pq_state': 'رفع/تحديث [{key,val,device,updated_at}] (upsert)',
        'GET|POST /rest/v1/pq_plans': 'باقات الأسعار (upsert حسب plan_key)',
        'GET /health': 'فحص الصحة',
      },
      tables: Object.fromEntries(Object.entries(TABLES).map(([t, k]) => [t, Object.keys(store[t] || {}).length])),
      timestamp: new Date().toISOString(),
    });
  }

  // فحص الصحة
  if (pathname === '/health') {
    return json(res, 200, { ok: true, tables: Object.fromEntries(Object.entries(TABLES).map(([t, k]) => [t, Object.keys(store[t] || {}).length])), uptime: process.uptime() });
  }

  // تحديد الجدول: /rest/v1/<table> أو /api/<table> أو /api/v1/<table>
  const m = pathname.match(/^\/(?:rest\/v1|api(?:\/v1)?)\/(\w+)$/);
  if (!m || !TABLES[m[1]]) {
    return json(res, 404, { error: 'Not found', path: pathname, supported: Object.keys(TABLES) });
  }
  const table = m[1];
  const pk = TABLES[table];

  // مصادقة
  if (!checkAuth(req, url)) {
    return json(res, 401, { error: 'Unauthorized', hint: 'أرسل Authorization: Bearer <API_KEY> أو apikey header أو ?apikey=' });
  }

  try {
    const bucket = store[table] = store[table] || {};

    if (req.method === 'GET') {
      const select = url.searchParams.get('select');
      const filterVal = parseEqFilter(url, pk);
      // ضمان وجود حقل المفتاح الأساسي داخل كل صف (الصيغة القديمة كانت تخزنه كاسم الخاصية)
      let rows = Object.entries(bucket).map(([k, r]) => (r && typeof r === 'object' && r[pk] !== undefined) ? r : Object.assign({}, (r && typeof r === 'object') ? r : { val: r }, { [pk]: k }));
      if (filterVal !== null) rows = rows.filter(r => String(r[pk]) === String(filterVal));
      if (select) rows = rows.map(r => project(r, select));
      return json(res, 200, rows);
    }

    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      const body = await readBody(req);
      let items = [];
      try { items = JSON.parse(body); } catch (e) {
        return json(res, 400, { error: 'Invalid JSON', detail: e.message });
      }
      let saved = 0;
      const apply = item => {
        if (item && typeof item === 'object' && item[pk] !== undefined) {
          const k = String(item[pk]);
          // للأعمدة الموجودة مسبقاً: دمج (resolution=merge-duplicates)
          bucket[k] = Object.assign({}, bucket[k] || {}, item, { updated_at: item.updated_at || new Date().toISOString() });
          saved++;
        }
      };
      if (Array.isArray(items)) items.forEach(apply);
      else if (items && typeof items === 'object') apply(items); // كائن مفرد
      else return json(res, 400, { error: 'Expected array of rows or a single row containing "' + pk + '"' });
      saveStore();
      return json(res, 201, { success: true, saved, total: Object.keys(bucket).length });
    }

    if (req.method === 'DELETE') {
      const key = parseEqFilter(url, pk);
      if (key !== null) {
        if (bucket[key] !== undefined) { delete bucket[key]; saveStore(); return json(res, 200, { success: true, deleted: key }); }
        return json(res, 404, { error: 'Key not found' });
      }
      store[table] = {}; saveStore();
      return json(res, 200, { success: true, cleared: true });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    return json(res, 500, { error: 'Server error', detail: e.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  ProQuote Sync Server v2.0.0             ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log('║  المنفذ:       ' + String(PORT).padEnd(26) + '║');
  console.log('║  مفتاح API:    ' + API_KEY.slice(0, 8) + '...'.padEnd(18) + '║');
  console.log('║  ملف البيانات: ' + path.basename(DATA_FILE).padEnd(20) + '║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log('في البرنامج: الإعدادات ← المزامنة السحابية');
  console.log('  رابط الخادم:  http://localhost:' + PORT);
  console.log('  المفتاح:      ' + API_KEY);
  console.log('');
  console.log('اضغط Ctrl+C للإيقاف');
});

// حفظ دوري كل 30 ثانية
setInterval(saveStore, 30000);

// حفظ عند الإيقاف
process.on('SIGINT', () => { saveStore(); console.log('\nتم الحفظ والإيقاف'); process.exit(0); });
process.on('SIGTERM', () => { saveStore(); process.exit(0); });
