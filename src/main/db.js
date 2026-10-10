// ============================================================
// ProQuote — طبقة التخزين الدائم (واجهة ثابتة أمام التطبيق)
// المحرك الحقيقي: مخزن kv SQLite مستقل لكل شركة (kvstore.js)
// عبر مدير الشركات (companies.js) — كل استدعاء هنا يوجَّه
// للمخزن النشط حالياً. الواجهة البرمجية مطابقة حرفياً
// للنسخ السابقة — لا تغيير في أي ملف آخر بالعملية الرئيسية.
// ============================================================

const { app } = require('electron');
const path = require('path');
const companies = require('./companies');

const S = () => companies.activeStore();

function getDataPath() { return S().dbFile; }
function getBackupDir() { return S().getBackupDir(); }

function load() { return S().open(); }
function open() { return S().open(); }
function getItem(key) { return S().getItem(key); }
function setItem(key, value) { S().setItem(key, value); }
function removeItem(key) { S().removeItem(key); }
function keys() { return S().keys(); }
function has(key) { return S().has(key); }
function clear() { S().clear(); }
function flush() { S().flush(); }
function forceFlush() { S().forceFlush(); }
function scheduleSave() { S().scheduleSave(); }

function stats() { return S().stats(); }
function getAll() { return S().getAll(); }
function replaceAll(dataObj) { S().replaceAll(dataObj); }

function createBackup(destPath, isAuto) {
  const cur = companies.active();
  return S().createBackup(destPath, isAuto, cur ? { company: cur.name, companyId: cur.id } : {});
}
function restoreBackup(srcPath) { return S().restoreBackup(srcPath); }
function autoBackup() { return S().autoBackup(); }
function listBackups() { return S().listBackups(); }

function getMeta() {
  const s = stats();
  const bps = listBackups();
  const cur = companies.active();
  const fs = require('fs');
  let fileBytes = 0;
  try { fileBytes = fs.statSync(s.dataPath).size; } catch (_) {}
  return {
    dataPath: s.dataPath,
    backupDir: s.backupDir,
    keyCount: s.keys,
    totalBytes: s.totalBytes,
    totalMB: Math.round(s.totalBytes / 1048576 * 100) / 100,
    backupCount: bps.length,
    lastBackup: bps[0] ? new Date(bps[0].mtime).toISOString() : null,
    appVersion: app.getVersion() || require('../package.json').version || '5.4.0',
    engine: 'sqlite',
    company: cur ? cur.name : null,
    companyId: cur ? cur.id : null,
    fileBytes
  };
}

module.exports = {
  load, open, flush, forceFlush, getDataPath, getBackupDir,
  getItem, setItem, removeItem, keys, has, clear, stats,
  getAll, replaceAll,
  createBackup, restoreBackup, autoBackup, listBackups,
  getMeta
};
