// ============================================================
// ProQuote — طبقة التخزين الدائم (JSON على القرص)
// بديل SQLite نقي (لا يحتاج تجميع أصلي / Python / Build Tools)
// الموقع: app.getPath('userData')/proquote.data.json
// نموذج key-value يحاكي مفاتيح localStorage الـ15 الأصلية تماماً
// ============================================================

const { app } = require('electron');
const path = require('path');
const fs = require('fs');

let _cache = null;      // نسخة في الذاكرة (سريعة)
let _dirty = false;     // هل هناك تغييرات غير محفوظة؟
let _saveTimer = null;  // مؤقت الحفظ المؤجل

function getDataPath() {
  return path.join(app.getPath('userData'), 'proquote.data.json');
}

function getBackupDir() {
  const dir = path.join(app.getPath('userData'), 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ---------- التحميل ----------
function load() {
  if (_cache) return _cache;
  const dataPath = getDataPath();
  try {
    if (fs.existsSync(dataPath)) {
      const raw = fs.readFileSync(dataPath, 'utf8');
      _cache = JSON.parse(raw);
    } else {
      _cache = {};
    }
  } catch (err) {
    console.error('[db] فشل قراءة ملف البيانات، بدء جديد:', err.message);
    // محاولة استرجاع من آخر نسخة احتياطية تلقائية
    _cache = tryRecoverFromBackup();
  }
  return _cache;
}

// ---------- الحفظ (مؤجل للحد من كتابات القرص) ----------
function scheduleSave() {
  _dirty = true;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(flush, 200); // حفظ بعد 200ms من آخر تعديل
}

function flush() {
  if (!_cache || !_dirty) return;
  const dataPath = getDataPath();
  try {
    // كتابة آمنة: اكتب لملف مؤقت ثم استبدل (atomic-ish على ويندوز)
    const tmp = dataPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(_cache), 'utf8');
    fs.renameSync(tmp, dataPath);
    _dirty = false;
  } catch (err) {
    console.error('[db] فشل الحفظ:', err.message);
    // محاولة كتابة مباشرة كبديل
    try {
      fs.writeFileSync(dataPath, JSON.stringify(_cache), 'utf8');
      _dirty = false;
    } catch (e) {
      console.error('[db] فشل الحفظ البديل أيضاً:', e.message);
    }
  }
}

// حفظ متزامن إجباري (قبل الإغلاق أو النسخ الاحتياطي)
function forceFlush() {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  flush();
}

// ============================================================
// عمليات key-value (توافق تام مع localStorage الأصلي)
// ============================================================

function getItem(key) {
  load();
  const v = _cache[key];
  return (v === undefined) ? null : String(v);
}

function setItem(key, value) {
  load();
  _cache[key] = String(value);
  scheduleSave();
}

function removeItem(key) {
  load();
  if (key in _cache) {
    delete _cache[key];
    scheduleSave();
  }
}

function keys() {
  load();
  return Object.keys(_cache);
}

function has(key) {
  load();
  return key in _cache;
}

function clear() {
  load();
  _cache = {};
  scheduleSave();
}

// إحصائيات
function stats() {
  load();
  const keyCount = Object.keys(_cache).length;
  let totalBytes = 0;
  try {
    totalBytes = Buffer.byteLength(JSON.stringify(_cache), 'utf8');
  } catch {}
  return {
    keys: keyCount,
    totalBytes,
    dataPath: getDataPath(),
    backupDir: getBackupDir()
  };
}

// كل أزواج key-value (للنسخ الاحتياطي/التصدير)
function getAll() {
  load();
  // إرجاع نسخة عميقة
  return JSON.parse(JSON.stringify(_cache));
}

// استبدال كامل (للاستعادة/الاستيراد)
function replaceAll(dataObj) {
  _cache = JSON.parse(JSON.stringify(dataObj));
  scheduleSave();
}

// ============================================================
// النسخ الاحتياطي والاستعادة
// ============================================================

// محاولة الاسترجاع من آخر نسخة تلقائية عند فساد البيانات
function tryRecoverFromBackup() {
  try {
    const dir = getBackupDir();
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.pqbak'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    if (files.length === 0) return {};
    const latest = path.join(dir, files[0].name);
    console.log('[db] استرجاع من النسخة الاحتياطية:', latest);
    const parsed = JSON.parse(fs.readFileSync(latest, 'utf8'));
    return parsed.data || parsed || {};
  } catch {
    return {};
  }
}

// إنشاء نسخة احتياطية كاملة
// الناتج: ملف .pqbak يحوي { meta, data, checksum }
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
  // التحقق من التوقيع إن وُجد
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
    // تنسيق قديم (مباشر)
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

    // تنظيف النسخ القديمة (الاحتفاظ بآخر 7)
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

// ميتا قاعدة البيانات (للعرض فقط)
function getMeta() {
  load();
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
    appVersion: app.getVersion() || require('../package.json').version || '5.4.0'
  };
}

module.exports = {
  load, flush, forceFlush, getDataPath,
  getItem, setItem, removeItem, keys, has, clear, stats,
  getAll, replaceAll,
  createBackup, restoreBackup, autoBackup, listBackups, tryRecoverFromBackup,
  getMeta
};
