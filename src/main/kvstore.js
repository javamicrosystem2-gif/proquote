// ============================================================
// ProQuote — مصنع مخازن key-value المعزولة (SQLite)
// كل شركة تحصل على مخزن مستقل تماماً: ملف قاعدة خاص +
// مجلد نسخ احتياطية خاص. عزل مطلق بلا أي تداخل.
// ============================================================

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// إنشاء مخزن جديد: createKvStore({ dbFile, backupDir, jsonLegacy })
// jsonLegacy (اختياري): مسار proquote.data.json القديم للترحيل مرة واحدة
function createKvStore(opts) {
  const { dbFile, backupDir } = opts;
  const jsonLegacy = opts.jsonLegacy || null;
  let _db = null;
  let _stmt = null;

  function ensureSchema(db) {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('busy_timeout = 5000');
    db.exec(`
      CREATE TABLE IF NOT EXISTS kv (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
      );
    `);
  }

  function open() {
    if (_db) return _db;
    try {
      fs.mkdirSync(path.dirname(dbFile), { recursive: true });
      _db = new Database(dbFile);
      ensureSchema(_db);
    } catch (err) {
      console.error('[kvstore] فشل الفتح، إعادة بناء من آخر نسخة:', err.message);
      try { if (fs.existsSync(dbFile)) fs.renameSync(dbFile, dbFile + '.corrupt-' + Date.now()); } catch (_) {}
      _db = new Database(dbFile);
      ensureSchema(_db);
      try {
        const baks = listBackups();
        if (baks.length) {
          const parsed = JSON.parse(fs.readFileSync(baks[0].path, 'utf8'));
          const data = parsed.data || parsed || {};
          replaceAll(data);
          console.log('[kvstore] استُرجع من:', baks[0].name);
        }
      } catch (e) { console.error('[kvstore] تعذرت الاستعادة:', e.message); }
    }
    migrateFromJsonIfNeeded();
    return _db;
  }

  function migrateFromJsonIfNeeded() {
    try {
      if (!jsonLegacy || !fs.existsSync(jsonLegacy)) return;
      const count = _db.prepare('SELECT COUNT(*) AS c FROM kv').get().c;
      if (count > 0) return;
      const data = JSON.parse(fs.readFileSync(jsonLegacy, 'utf8'));
      const ks = Object.keys(data || {});
      if (!ks.length) return;
      const ins = _db.prepare('INSERT OR REPLACE INTO kv(key, value, updated_at) VALUES (?, ?, ?)');
      _db.transaction(() => { for (const k of ks) ins.run(k, String(data[k]), Date.now()); })();
      const archived = jsonLegacy + '.imported-' + new Date().toISOString().slice(0, 10);
      fs.renameSync(jsonLegacy, archived);
      console.log('[kvstore] ✅ رُحّل ' + ks.length + ' مفتاحاً من JSON — الأصل مؤرشف:', path.basename(archived));
    } catch (err) {
      console.error('[kvstore] فشل ترحيل JSON (يُعاد بالمحاولة القادمة):', err.message);
    }
  }

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

  // ---------- عمليات key-value ----------
  function getItem(key) { open(); const r = stmts().get.get(key); return r ? r.value : null; }
  function setItem(key, value) { open(); stmts().put.run(String(key), String(value), Date.now()); }
  function removeItem(key) { open(); stmts().del.run(key); }
  function keys() { open(); return stmts().keys.all().map(r => r.key); }
  function has(key) { open(); return !!stmts().has.get(key); }
  function clear() { open(); stmts().delAll.run(); }
  function flush() {}
  function forceFlush() { try { if (_db) _db.pragma('wal_checkpoint(TRUNCATE)'); } catch (_) {} }
  function scheduleSave() {}

  function stats() {
    open();
    const s = stmts().count.get();
    let fileBytes = 0;
    try { fileBytes = fs.statSync(dbFile).size; } catch {}
    return { keys: s.c, totalBytes: s.bytes, fileBytes, dataPath: dbFile, backupDir, engine: 'sqlite' };
  }

  function getAll() {
    open();
    const out = {};
    for (const row of stmts().all.all()) out[row.key] = row.value;
    return out;
  }

  function replaceAll(dataObj) {
    open();
    const put = stmts().put;
    _db.transaction(() => {
      stmts().delAll.run();
      for (const k in (dataObj || {})) put.run(k, String(dataObj[k]), Date.now());
    })();
  }

  // ---------- النسخ الاحتياطي (داخل مجلد الشركة) ----------
  function getBackupDir() {
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    return backupDir;
  }

  function listBackups() {
    try {
      return fs.readdirSync(getBackupDir())
        .filter(f => f.endsWith('.pqbak'))
        .map(f => {
          const p = path.join(backupDir, f);
          const st = fs.statSync(p);
          return { name: f, path: p, size: st.size, mtime: st.mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);
    } catch { return []; }
  }

  function createBackup(destPath, isAuto, metaExtra) {
    forceFlush();
    const data = getAll();
    const payload = {
      meta: Object.assign({
        app: 'ProQuote',
        createdAt: new Date().toISOString(),
        keyCount: Object.keys(data).length,
        auto: !!isAuto
      }, metaExtra || {}),
      data
    };
    const json = JSON.stringify(payload, null, 2);
    payload.checksum = require('crypto').createHash('sha256').update(json).digest('hex');
    const finalJson = JSON.stringify(payload, null, 2);
    fs.writeFileSync(destPath, finalJson, 'utf8');
    return { path: destPath, size: Buffer.byteLength(finalJson, 'utf8'), keyCount: Object.keys(data).length };
  }

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
    } else if (parsed.data) data = parsed.data;
    else data = parsed;
    replaceAll(data);
    return { keyCount: Object.keys(data).length };
  }

  function autoBackup() {
    try {
      const dir = getBackupDir();
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const dest = path.join(dir, `auto-${ts}.pqbak`);
      createBackup(dest, true);
      const files = fs.readdirSync(dir)
        .filter(f => f.startsWith('auto-') && f.endsWith('.pqbak'))
        .map(f => ({ name: f, path: path.join(dir, f), mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);
      if (files.length > 7) files.slice(7).forEach(f => { try { fs.unlinkSync(f.path); } catch {} });
      return dest;
    } catch (err) {
      console.error('[kvstore] فشل النسخ التلقائي:', err.message);
      return null;
    }
  }

  // إغلاق نهائي عند التبديل بين الشركات
  function close() {
    try { forceFlush(); } catch (_) {}
    try { if (_db) _db.close(); } catch (_) {}
    _db = null; _stmt = null;
  }

  return {
    open, close, dbFile, backupDir,
    getItem, setItem, removeItem, keys, has, clear,
    flush, forceFlush, scheduleSave, stats, getAll, replaceAll,
    getBackupDir, listBackups, createBackup, restoreBackup, autoBackup
  };
}

module.exports = { createKvStore };
