// ============================================================
// ProQuote — طبقة التخزين الدائم (SQLite عبر better-sqlite3)
// الموقع: app.getPath('userData')/proquote.data.db
// نموذج key-value يحاكي مفاتيح localStorage الأصلية تماماً
// الواجهة البرمجية مطابقة حرفياً للنسخة السابقة (JSON) —
// لا يتغير أي شيء في preload أو main.js أو الواجهة.
// الترحيل: عند أول فتح، لو وُجد proquote.data.json القديم
// والقاعدة فارغة → استيراد كامل → إعادة تسمية الملف القديم
// إلى .imported-<تاريخ> (لا يُحذف أبداً).
// ============================================================

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

let _db = null; // اتصال SQLite (يُفتح كسولاً عند أول استخدام)

function getDbPath() {
  return path.join(app.getPath('userData'), 'proquote.data.db');
}
function getJsonPath() {
  return path.join(app.getPath('userData'), 'proquote.data.json');
}

function getBackupDir() {
  const dir = path.join(app.getPath('userData'), 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ---------- الفتح + التهيئة + الترحيل من JSON ----------
function open() {
  if (_db) return _db;
  const dbPath = getDbPath();
  try {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    _db = new Database(dbPath);
    // وضع WAL: كتابة آمنة مقاومة للانهيار + أداء عالٍ
    _db.pragma('journal_mode = WAL');
    _db.pragma('synchronous = NORMAL');
    _db.pragma('busy_timeout = 5000');
    _db.exec(`
      CREATE TABLE IF NOT EXISTS kv (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
      );
    `);
  } catch (err) {
    console.error('[db] فشل فتح قاعدة SQLite، محاولة الاسترجاع من النسخ الاحتياطية:', err.message);
    _db = recoverDbFromBackup(dbPath);
  }
  migrateFromJsonIfNeeded();
  return _db;
}

// إعادة بناء القاعدة من آخر نسخة احتياطية عند الفساد النادر
function recoverDbFromBackup(dbPath) {
  try { if (fs.existsSync(dbPath)) fs.renameSync(dbPath, dbPath + '.corrupt-' + Date.now()); } catch (_) {}
  const fresh = new Database(dbPath);
  fresh.pragma('journal_mode = WAL');
  fresh.pragma('synchronous = NORMAL');
  fresh.pragma('busy_timeout = 5000');
  fresh.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL DEFAULT (strftime(\'%s\',\'now\') * 1000));');
  // محاولة ملئها من آخر .pqbak
  try {
    const baks = listBackups();
    if (baks.length) {
      const parsed = JSON.parse(fs.readFileSync(baks[0].path, 'utf8'));
      const data = parsed.data || parsed || {};
      const ins = fresh.prepare('INSERT OR REPLACE INTO kv(key, value, updated_at) VALUES (?, ?, ?)');
      const tx = fresh.transaction((obj) => { for (const k in obj) ins.run(k, String(obj[k]), Date.now()); });
      tx(data);
      console.log('[db] تمت استعادة القاعدة من:', baks[0].name);
    }
  } catch (e) { console.error('[db] تعذرت الاستعادة من النسخ:', e.message); }
  return fresh;
}

// ترحيل تلقائي مرة واحدة من ملف JSON القديم (بدون حذفه أبداً)
function migrateFromJsonIfNeeded() {
  try {
    const jsonPath = getJsonPath();
    if (!fs.existsSync(jsonPath)) return;
    const count = _db.prepare('SELECT COUNT(*) AS c FROM kv').get().c;
    if (count > 0) {
      // القاعدة معمّرة بالفعل — الملف القديم تاريخي فقط؛ نُبقيه كما هو
      return;
    }
    const raw = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(raw);
    const keys = Object.keys(data || {});
    if (!keys.length) return;
    const ins = _db.prepare('INSERT OR REPLACE INTO kv(key, value, updated_at) VALUES (?, ?, ?)');
    const tx = _db.transaction((obj) => { for (const k of keys) ins.run(k, String(obj[k]), Date.now()); });
    tx(data);
    // إعادة تسمية وليس حذفاً — يظل أثراً أمانياً دائماً
    const archived = jsonPath + '.imported-' + new Date().toISOString().slice(0, 10);
    fs.renameSync(jsonPath, archived);
    console.log('[db] ✅ تم ترحيل ' + keys.length + ' مفتاحاً من JSON إلى SQLite — الأصل مؤرشف: ' + path.basename(archived));
  } catch (err) {
    console.error('[db] فشل ترحيل JSON (سيُعاد المحاولة في الإقلاع القادم):', err.message);
  }
}

// عبارات مُجهزة (تُنشأ مرة عند أول استخدام)
let _stmt = null;
function stmts() {
  if (!_stmt) {
    _stmt = {
      get:    _db.prepare('SELECT value FROM kv WHERE key = ?'),
      put:    _db.prepare('INSERT INTO kv(key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'),
      del:    _db.prepare('DELETE FROM kv WHERE key = ?'),
      keys:   _db.prepare('SELECT key FROM kv'),
      has:    _db.prepare('SELECT 1 FROM kv WHERE key = ? LIMIT 1'),
      delAll: _db.prepare('DELETE FROM kv'),
      count:  _db.prepare('SELECT COUNT(*) AS c, COALESCE(SUM(LENGTH(value)),0) AS bytes FROM kv'),
      all:    _db.prepare('SELECT key, value FROM kv')
    };
  }
  return _stmt;
}

// ============================================================
// عمليات key-value (توافق تام مع الواجهة السابقة)
// ============================================================

function getItem(key) {
  open();
  const row = stmts().get.get(key);
  return row ? row.value : null;
}

function setItem(key, value) {
  open();
  stmts().put.run(String(key), String(value), Date.now());
}

function removeItem(key) {
  open();
  stmts().del.run(key);
}

function keys() {
  open();
  return stmts().keys.all().map(r => r.key);
}

function has(key) {
  open();
  return !!stmts().has.get(key);
}

function clear() {
  open();
  stmts().delAll.run();
}

// الحفظ الفوري مضمون بكل عملية كتابة (بدون مؤجلات) —
// نُبقي الدوال للتوافق التام مع الاستدعاءات القائمة
function flush() {}
function forceFlush() {
  try { if (_db) _db.pragma('wal_checkpoint(TRUNCATE)'); } catch (_) {}
}
function scheduleSave() {} // موروثة من الواجهة القديمة — لم تعد مطلوبة

// إحصائيات
function stats() {
  open();
  const s = stmts().count.get();
  let fileBytes = 0;
  try { fileBytes = fs.statSync(getDbPath()).size; } catch {}
  return {
    keys: s.c,
    totalBytes: s.bytes,
    fileBytes,
    dataPath: getDbPath(),
    backupDir: getBackupDir(),
    engine: 'sqlite'
  };
}

// كل أزواج key-value (للنسخ الاحتياطي/التصدير)
function getAll() {
  open();
  const out = {};
  for (const row of stmts().all.all()) out[row.key] = row.value;
  return out;
}

// استبدال كامل (للاستعادة/الاستيراد) — معاملة واحدة ذرّية
function replaceAll(dataObj) {
  open();
  const put = stmts().put;
  const tx = _db.transaction((obj) => {
    stmts().delAll.run();
    for (const k in obj) put.run(k, String(obj[k]), Date.now());
  });
  tx(dataObj || {});
}

// ============================================================
// النسخ الاحتياطي والاستعادة (نفس صيغة .pqbak السابقة تماماً)
// ============================================================

// قائمة النسخ الاحتياطية المتوفرة
function listBackups() {
  const dir = getBackupDir();
  try {
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.pqbak'))
      .map(f => {
        const p = path.join(dir, f);
        const st = fs.statSync(p);
        return { name: f, path: p, size: st.size, mtime: st.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
  } catch {
    return [];
  }
}

// إنشاء نسخة احتياطية كاملة — { meta, data, checksum } بصيغة JSON
// (متوافقة قراءةً وكتابةً مع كل الإصدارات السابقة واللاحقة)
function createBackup(destPath, isAuto = false) {
  forceFlush();
  const data = getAll();
  const payload = {
    meta: {
      app: 'ProQuote',
      version: app.getVersion() || require('../package.json').version || '5.4.0',
      createdAt: new Date().toISOString(),
      keyCount: Object.keys(data).length,
      auto: isAuto
    },
    data
  };
  const json = JSON.stringify(payload, null, 2);
  const checksum = require('crypto').createHash('sha256').update(json).digest('hex');
  payload.checksum = checksum;

  const finalJson = JSON.stringify(payload, null, 2);
  fs.writeFileSync(destPath, finalJson, 'utf8');
  return { path: destPath, size: Buffer.byteLength(finalJson, 'utf8'), keyCount: Object.keys(data).length };
}

// استعادة من نسخة احتياطية (مع التحقق من السلامة)
function restoreBackup(srcPath) {
  const raw = fs.readFileSync(srcPath, 'utf8');
  const parsed = JSON.parse(raw);
  let data;
  if (parsed.data && parsed.checksum) {
    const verify = { ...parsed };
    delete verify.checksum;
    const recomputed = require('crypto').createHash('sha256')
      .update(JSON.stringify(verify, null, 2)).digest('hex');
    if (recomputed !== parsed.checksum) {
      throw new Error('فشل التحقق من سلامة ملف النسخة الاحتياطية (checksum غير مطابق)');
    }
    data = parsed.data;
  } else if (parsed.data) {
    data = parsed.data;
  } else {
    data = parsed;
  }
  replaceAll(data);
  return { keyCount: Object.keys(data).length };
}

// نسخة احتياطية تلقائية (تُحفظ في userData/backups، يُحتفظ بآخر 7)
function autoBackup() {
  try {
    const dir = getBackupDir();
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const fname = `auto-${ts}.pqbak`;
    const dest = path.join(dir, fname);
    createBackup(dest, true);

    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith('auto-') && f.endsWith('.pqbak'))
      .map(f => ({ name: f, path: path.join(dir, f), mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    if (files.length > 7) {
      files.slice(7).forEach(f => {
        try { fs.unlinkSync(f.path); } catch {}
      });
    }
    return dest;
  } catch (err) {
    console.error('[db] فشل النسخ الاحتياطي التلقائي:', err.message);
    return null;
  }
}

// ميتا قاعدة البيانات (للعرض فقط)
function getMeta() {
  const s = stats();
  const bps = listBackups();
  return {
    dataPath: s.dataPath,
    backupDir: s.backupDir,
    keyCount: s.keys,
    totalBytes: s.totalBytes,
    totalMB: Math.round(s.totalBytes / 1048576 * 100) / 100,
    backupCount: bps.length,
    lastBackup: bps[0] ? new Date(bps[0].mtime).toISOString() : null,
    appVersion: app.getVersion() || require('../package.json').version || '5.4.0',
    engine: 'sqlite'
  };
}

module.exports = {
  load: open, // توافق: الاستدعاء القديم load() يفتح القاعدة
  open, flush, forceFlush, getDataPath: getDbPath,
  getItem, setItem, removeItem, keys, has, clear, stats,
  getAll, replaceAll,
  createBackup, restoreBackup, autoBackup, listBackups,
  getMeta
};
