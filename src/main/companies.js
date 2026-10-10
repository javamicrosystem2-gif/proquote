// ============================================================
// ProQuote — إدارة الشركات (Multi-tenancy بعزل ملفات كامل)
// السجل: companies/registry.db  → جدول companies
// بيانات كل شركة: companies/c<id>.db (مخزن kv مستقل تماماً)
// النسخ الاحتياطية: companies/c<id>.backups/
// عند أول تشغيل: تُنشأ شركة «شركتي» وتمتص البيانات الحالية
// (proquote.data.db القديم أو proquote.data.json) كما هي.
// ============================================================

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { createKvStore } = require('./kvstore');

let _reg = null;            // اتصال سجل الشركات
let _activeId = null;       // الشركة النشطة حالياً
let _activeStore = null;    // مخزن الشركة النشطة
let _switching = false;     // حارس: نرفض كتابات التخزين أثناء التبديل

function companiesDir() { return path.join(app.getPath('userData'), 'companies'); }
function registryPath() { return path.join(companiesDir(), 'registry.db'); }
function legacyJsonPath() { return path.join(app.getPath('userData'), 'proquote.data.json'); }
function legacyDbPath() { return path.join(app.getPath('userData'), 'proquote.data.db'); }
function legacyBackupsDir() { return path.join(app.getPath('userData'), 'backups'); }

function companyDbFile(id) { return path.join(companiesDir(), 'c' + id + '.db'); }
function companyBackupDir(id) { return path.join(companiesDir(), 'c' + id + '.backups'); }

function registry() {
  if (_reg) return _reg;
  fs.mkdirSync(companiesDir(), { recursive: true });
  _reg = new Database(registryPath());
  _reg.pragma('journal_mode = WAL');
  _reg.pragma('busy_timeout = 5000');
  _reg.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `);
  return _reg;
}

// ---------- التهيئة (كسولة — تُنفَّذ قبل أي استخدام) ----------
function init() {
  const reg = registry();
  const rows = reg.prepare('SELECT * FROM companies ORDER BY is_default DESC, id ASC').all();
  if (!rows.length) {
    // أول تشغيل: شركة افتراضية «شركتي» تمتص أي بيانات موجودة كما هي
    const info = reg.prepare('INSERT INTO companies(name, is_default, created_at) VALUES (?, 1, ?)').run('شركتي', Date.now());
    const id = info.lastInsertRowid;
    absorbLegacyInto(id);
    console.log('[companies] أُنشئت الشركة الافتراضية «شركتي» (id=' + id + ')');
    _activeId = id;
    _activeStore = null;
  }
}

// نقل البيانات القديمة (قاعدة 9.8.0 الجذرية أو JSON الأقدم) إلى شركة id
function absorbLegacyInto(id) {
  const dbFile = companyDbFile(id);
  try {
    // 1) قاعدة الجذر من الإصدار 9.8.0 → نقل الملف كما هو (بلا أي إعادة كتابة)
    if (fs.existsSync(legacyDbPath()) && !fs.existsSync(dbFile)) {
      fs.mkdirSync(companiesDir(), { recursive: true });
      fs.renameSync(legacyDbPath(), dbFile);
      // ملفات WAL/SHM المرافقة إن وجدت
      for (const ext of ['-wal', '-shm']) {
        try { if (fs.existsSync(legacyDbPath() + ext)) fs.renameSync(legacyDbPath() + ext, dbFile + ext); } catch (_) {}
      }
      console.log('[companies] امتُصّت قاعدة البيانات الجذرية إلى الشركة c' + id);
    }
    // 2) نسخ احتياطية الجذر القديمة → مجلد نسخ الشركة (تظل قابلة للاستعادة)
    const legacyBak = legacyBackupsDir();
    const dstBak = companyBackupDir(id);
    if (fs.existsSync(legacyBak) && !fs.existsSync(dstBak)) {
      try {
        fs.mkdirSync(dstBak, { recursive: true });
        const baks = fs.readdirSync(legacyBak).filter(f => f.endsWith('.pqbak'));
        for (const f of baks) { try { fs.renameSync(path.join(legacyBak, f), path.join(dstBak, f)); } catch (_) {} }
        if (baks.length) console.log('[companies] نُقلت ' + baks.length + ' نسخة احتياطية قديمة إلى الشركة c' + id);
      } catch (_) {}
    }
    // 3) JSON التراثي (قبل 9.8.0) — يرحّله المخزن نفسه عند أول فتح
  } catch (err) {
    console.error('[companies] فشل استيعاب البيانات القديمة:', err.message);
  }
}

// ---------- الشركة النشطة ومخزنها ----------
function active() {
  init();
  const row = registry().prepare('SELECT * FROM companies WHERE id = ?').get(_activeIdOf());
  return row ? { id: row.id, name: row.name, isDefault: !!row.is_default, createdAt: row.created_at } : null;
}

function _activeIdOf() {
  if (_activeId) return _activeId;
  const row = registry().prepare('SELECT id FROM companies WHERE is_default = 1').get()
    || registry().prepare('SELECT id FROM companies ORDER BY id ASC LIMIT 1').get();
  if (!row) return null;
  _activeId = row.id;
  return _activeId;
}

function activeStore() {
  if (_activeStore) return _activeStore;
  init();
  const id = _activeIdOf();
  if (!id) throw new Error('لا توجد شركات مسجلة');
  _activeStore = createKvStore({
    dbFile: companyDbFile(id),
    backupDir: companyBackupDir(id),
    jsonLegacy: legacyJsonPath()
  });
  return _activeStore;
}

function isSwitching() { return _switching; }

// ---------- العمليات ----------
function list() {
  init();
  return registry().prepare('SELECT id, name, is_default AS isDefault, created_at AS createdAt FROM companies ORDER BY is_default DESC, id ASC').all();
}

function create(name) {
  init();
  const clean = String(name || '').trim();
  if (!clean) return { ok: false, error: 'أدخل اسم الشركة' };
  if (clean.length > 60) return { ok: false, error: 'الاسم طويل جداً (60 حرفاً كحد أقصى)' };
  try {
    const info = registry().prepare('INSERT INTO companies(name, is_default, created_at) VALUES (?, 0, ?)').run(clean, Date.now());
    const id = info.lastInsertRowid;
    // فتح فوري لإنشاء الملف والجداول (شركة فارغة جاهزة)
    const s = createKvStore({ dbFile: companyDbFile(id), backupDir: companyBackupDir(id), jsonLegacy: null });
    s.open(); s.forceFlush(); s.close();
    console.log('[companies] أُنشئت شركة: ' + clean + ' (id=' + id + ')');
    return { ok: true, id: Number(id), name: clean };
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return { ok: false, error: 'يوجد شركة بهذا الاسم بالفعل' };
    return { ok: false, error: e.message };
  }
}

// تعيين افتراضية + تبديل الاتصال — تُستدعى من IPC ثم يعيد المُرسل تحميل الواجهة
function setDefault(id) {
  init();
  const reg = registry();
  const row = reg.prepare('SELECT * FROM companies WHERE id = ?').get(id);
  if (!row) return { ok: false, error: 'الشركة غير موجودة' };
  if (row.is_default && _activeId === id && _activeStore) return { ok: true, already: true };

  // حارس: منع أي كتابات جديدة على المخزن أثناء التبديل
  _switching = true;
  try {
    if (_activeStore) { _activeStore.forceFlush(); _activeStore.close(); }
    _activeStore = null;
    reg.transaction(() => {
      reg.prepare('UPDATE companies SET is_default = 0').run();
      reg.prepare('UPDATE companies SET is_default = 1 WHERE id = ?').run(id);
    })();
    _activeId = id;
    _activeStore = createKvStore({
      dbFile: companyDbFile(id),
      backupDir: companyBackupDir(id),
      jsonLegacy: legacyJsonPath()
    });
    _activeStore.open();
    console.log('[companies] ↪ الاتصال الآن بشركة: ' + row.name + ' (c' + id + '.db)');
    return { ok: true, name: row.name };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    _switching = false;
  }
}

function remove(id) {
  init();
  const reg = registry();
  const row = reg.prepare('SELECT * FROM companies WHERE id = ?').get(id);
  if (!row) return { ok: false, error: 'الشركة غير موجودة' };
  if (row.is_default) return { ok: false, error: 'لا يمكن حذف الشركة الافتراضية — عيّن غيرها أولاً' };
  const total = reg.prepare('SELECT COUNT(*) AS c FROM companies').get().c;
  if (total <= 1) return { ok: false, error: 'لا يمكن حذف الشركة الوحيدة' };
  try {
    reg.prepare('DELETE FROM companies WHERE id = ?').run(id);
    for (const f of [companyDbFile(id), companyDbFile(id) + '-wal', companyDbFile(id) + '-shm']) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
    }
    try { fs.rmSync(companyBackupDir(id), { recursive: true, force: true }); } catch (_) {}
    console.log('[companies] حُذفت شركة: ' + row.name + ' (id=' + id + ')');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function setSwitchingDone() { _switching = false; }

module.exports = {
  init, list, create, setDefault, remove,
  active, activeStore, isSwitching, setSwitchingDone,
  companiesDir, companyDbFile, companyBackupDir
};
