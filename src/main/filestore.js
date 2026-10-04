// ============================================================
// ProQuote — التخزين الآمن للملفات (FileStore)
// الملفات تُحفظ بصيغتها الأصلية على القرص في %APPDATA%\ProQuote\PQFiles
// بلا Base64 ولا حدود حجم عملية — مع فهرس في ملف البيانات
// والبروتوكول الداخلي pqfile:// للعرض المباشر داخل الواجهة
// ============================================================
const fs = require('fs');
const path = require('path');
const { app, dialog, ipcMain, protocol, net } = require('electron');
const db = require('./db');

const FILES_DIR = () => path.join(app.getPath('userData'), 'PQFiles');
const INDEX_KEY = 'pq_files_index';

function ensureDirs() {
  const ud = app.getPath('userData');
  const dirs = [FILES_DIR(), path.join(ud, 'تصدير'), path.join(ud, 'استيراد'), path.join(ud, 'نسخة احتياطية'), path.join(ud, 'استعادة')];
  dirs.forEach(d => { try { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); } catch (e) { console.error('[filestore] mkdir:', e.message); } });
}

function _index() {
  try { return JSON.parse(db.getItem(INDEX_KEY) || '{}'); } catch (e) { return {}; }
}
function _saveIndex(idx) { db.setItem(INDEX_KEY, JSON.stringify(idx)); db.flush(); }

function _safeName(n) { return String(n || 'file').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80); }
function _mimeFromName(n) {
  const e = (n || '').split('.').pop().toLowerCase();
  const m = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml', pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', zip: 'application/zip', rar: 'application/vnd.rar' };
  return m[e] || 'application/octet-stream';
}

// ---------- الواجهة البرمجية ----------
function saveFile(name, buffer, type) {
  ensureDirs();
  const id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const safe = id + '__' + _safeName(name);
  const fp = path.join(FILES_DIR(), safe);
  fs.writeFileSync(fp, Buffer.from(buffer));
  const idx = _index();
  idx[id] = { name: name || safe, type: type || _mimeFromName(name), size: buffer.byteLength || buffer.length, file: safe, at: Date.now() };
  _saveIndex(idx);
  return { id, url: 'pqfile://' + id, name: idx[id].name, type: idx[id].type, size: idx[id].size };
}

function getMeta(id) { return _index()[id] || null; }

function readBuffer(id) {
  const m = getMeta(id); if (!m) return null;
  const fp = path.join(FILES_DIR(), m.file);
  try { return fs.readFileSync(fp); } catch (e) { return null; }
}

function deleteFile(id) {
  const idx = _index(); const m = idx[id]; if (!m) return false;
  try { fs.unlinkSync(path.join(FILES_DIR(), m.file)); } catch (e) {}
  delete idx[id]; _saveIndex(idx); return true;
}

// حفظ باسم (تنزيل أصلي لمجلد المستخدم) — يُرجع المسار أو null
async function saveTo(id, suggestedName) {
  const m = getMeta(id); if (!m) return null;
  const buf = readBuffer(id); if (!buf) return null;
  const r = await dialog.showSaveDialog({ defaultPath: suggestedName || m.name });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, buf);
  return r.filePath;
}

// ترحيل dataURL قديم إلى التخزين الآمن — يُرجع pqfile:// أو null
function migrateDataURL(dataURL) {
  try {
    const m = String(dataURL).match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return null;
    const buf = Buffer.from(m[2], 'base64');
    const ext = (m[1].split('/')[1] || 'bin').replace('svg+xml', 'svg').replace('jpeg', 'jpg');
    const r = saveFile('migrated.' + ext, buf, m[1]);
    return r.url;
  } catch (e) { return null; }
}

function stats() {
  const idx = _index();
  let total = 0; Object.values(idx).forEach(m => { total += m.size || 0; });
  return { count: Object.keys(idx).length, bytes: total, dir: FILES_DIR() };
}

// ---------- بروتوكول pqfile:// ----------
function registerProtocol() {
  protocol.registerSchemesAsPrivileged([{ scheme: 'pqfile', privileges: { standard: false, supportFetchAPI: true, stream: true } }]);
  app.whenReady().then(() => {
    try {
      protocol.handle('pqfile', (request) => {
        const id = decodeURIComponent(request.url.replace(/^pqfile:\/\//, '').split(/[?#]/)[0]).trim();
        const m = getMeta(id);
        if (!m) return new Response(null, { status: 404 });
        const buf = readBuffer(id);
        if (!buf) return new Response(null, { status: 404 });
        return new Response(buf, { headers: { 'Content-Type': m.type || 'application/octet-stream', 'Content-Length': String(buf.length) } });
      });
      console.log('[filestore] pqfile:// protocol registered');
    } catch (e) { console.error('[filestore] protocol:', e.message); }
  });
}

// ---------- IPC ----------
function registerIpc() {
  ipcMain.handle('files:save', (_e, name, data, type) => {
    try { return { success: true, ...saveFile(name, data, type) }; } catch (e) { return { success: false, error: e.message }; }
  });
  ipcMain.handle('files:getMeta', (_e, id) => getMeta(id));
  ipcMain.handle('files:read', (_e, id) => { const b = readBuffer(id); return b ? b.toString('base64') : null; });
  ipcMain.handle('files:delete', (_e, id) => deleteFile(id));
  ipcMain.handle('files:saveTo', (_e, id, suggested) => saveTo(id, suggested));
  ipcMain.handle('files:migrateDataURL', (_e, dataURL) => { const u = migrateDataURL(dataURL); return u ? { success: true, url: u } : { success: false }; });
  ipcMain.handle('files:stats', () => stats());
  ipcMain.handle('files:openDir', async () => { ensureDirs(); const { shell } = require('electron'); shell.openPath(FILES_DIR()); return true; });
}

function init() { ensureDirs(); registerIpc(); registerProtocol(); }

module.exports = { init, ensureDirs, saveFile, getMeta, readBuffer, deleteFile, saveTo, migrateDataURL, stats, FILES_DIR, INDEX_KEY };
