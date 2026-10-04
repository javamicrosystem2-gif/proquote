// ============================================================
// ProQuote — نظام ترحيل البيانات + فحص الصحة + التراجع التلقائي
// يضمن عدم فقد أي أدوات أو بيانات عند التحديثات المستقبلية
// ============================================================
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const db = require('./db');

const BOOT_FLAG = () => path.join(app.getPath('userData'), '_boot.flag');
const DATA_VERSION_KEY = '__data_version__';

// ---------- 1) سجل الترحيلات (يُضاف هنا مستقبلاً) ----------
// كل ترحيل: { from: '5.3', to: '5.4', run(data) { ... return data } }
const MIGRATIONS = [
  // مثال مستقبلي:
  // { from: '5.4.0', to: '5.5.0', run(data) { data.newKey = 'value'; return data } }
];

// ---------- 2) تشغيل الترحيلات عند اختلاف الإصدار ----------
function runDataMigrations() {
  try {
    const appVersion = app.getVersion() || '5.4.0';
    const storedVersion = db.getItem(DATA_VERSION_KEY);
    if (!storedVersion) {
      // أول مرة — تخزين الإصدار الحالي
      db.setItem(DATA_VERSION_KEY, appVersion);
      db.flush();
      console.log('[migration] Data version initialized:', appVersion);
      return { migrated: false, from: null, to: appVersion };
    }
    if (storedVersion === appVersion) {
      return { migrated: false, from: storedVersion, to: appVersion };
    }
    // الإصدار مختلف — تشغيل الترحيلات المناسبة
    console.log('[migration] Data version change detected:', storedVersion, '→', appVersion);
    let applied = 0;
    MIGRATIONS.forEach(m => {
      if (m.from === storedVersion) {
        try {
          const data = db.getAll();
          const newData = m.run(data);
          if (newData) db.replaceAll(newData);
          applied++;
          console.log('[migration] Applied:', m.from, '→', m.to);
        } catch (e) { console.error('[migration] Failed:', m.from, '→', m.to, e.message); }
      }
    });
    db.setItem(DATA_VERSION_KEY, appVersion);
    db.flush();
    return { migrated: true, from: storedVersion, to: appVersion, applied };
  } catch (e) {
    console.error('[migration] Error:', e.message);
    return { migrated: false, error: e.message };
  }
}

// ---------- 3) فحص صحة البيانات عند الإقلاع ----------
function healthCheck() {
  const results = { jsonValid: false, hasKeys: false, keyCount: 0, recovered: false };
  try {
    const dataPath = db.getDataPath();
    if (!fs.existsSync(dataPath)) {
      console.log('[health] Data file not found (first run?) — OK');
      results.jsonValid = true; results.hasKeys = true;
      return results;
    }
    const raw = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(raw); // throws if corrupt
    results.jsonValid = true;
    results.keyCount = Object.keys(data).length;
    results.hasKeys = results.keyCount > 0;
    if (!results.hasKeys) console.warn('[health] Data file has 0 keys');
    console.log('[health] OK —', results.keyCount, 'keys');
  } catch (e) {
    console.error('[health] Data file corrupt:', e.message);
    // محاولة الاستعادة من آخر نسخة احتياطية
    try {
      const backups = db.listBackups();
      if (backups && backups.length > 0) {
        const latest = backups[0]; // sorted by mtime desc
        console.log('[health] Attempting recovery from:', latest.name);
        const restoreResult = db.restoreBackup(latest.path);
        if (restoreResult && restoreResult.success) {
          results.recovered = true;
          results.jsonValid = true;
          results.keyCount = Object.keys(db.getAll()).length;
          results.hasKeys = results.keyCount > 0;
          console.log('[health] Recovery successful —', results.keyCount, 'keys restored');
        }
      }
    } catch (re) { console.error('[health] Recovery failed:', re.message); }
  }
  return results;
}

// ---------- 4) آلية التراجع التلقائي (3 إخفاقات → استعادة) ----------
function initBootFlag() {
  try {
    const fp = BOOT_FLAG();
    let count = 0;
    if (fs.existsSync(fp)) { count = parseInt(fs.readFileSync(fp, 'utf8')) || 0; }
    count++;
    fs.writeFileSync(fp, String(count));
    console.log('[boot] Startup count:', count);
    if (count >= 3) {
      console.warn('[boot] 3+ failed startups — rolling back to last backup');
      try {
        const backups = db.listBackups();
        if (backups && backups.length > 0) {
          db.restoreBackup(backups[0].path);
          console.log('[boot] Rolled back to:', backups[0].name);
        }
      } catch (e) { console.error('[boot] Rollback failed:', e.message); }
      // إعادة العداد
      fs.writeFileSync(fp, '0');
    }
    return count;
  } catch (e) { console.error('[boot] Flag error:', e.message); return 0; }
}

function clearBootFlag() {
  try { if (fs.existsSync(BOOT_FLAG())) fs.unlinkSync(BOOT_FLAG()); } catch (e) {}
}

// ---------- 5) التهيئة الكاملة (تُستدعى من main.js) ----------
function init() {
  const bootCount = initBootFlag();
  const health = healthCheck();
  const migrationResult = runDataMigrations();
  // إذا وصلنا هنا — الإقلاع نجح
  setTimeout(() => { clearBootFlag(); }, 10000); // مسح العلامة بعد 10 ثوانٍ (تأكيد النجاح)
  return { bootCount, health, migrationResult };
}

module.exports = { init, healthCheck, runDataMigrations, initBootFlag, clearBootFlag, DATA_VERSION_KEY };
