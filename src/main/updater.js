// ============================================================
// ProQuote — التحديث التلقائي (electron-updater)
// تحقق من التحديثات + تنزيل + تثبيت + تراجع عند الفشل
// ملاحظة: يتطلب خادم استضافة (GitHub Releases أو generic) + توقيع الكود
//          للعمل بشكل موثوق. حالياً البنية جاهزة وتُفعّل عند توفر الخادم.
// ============================================================

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('./db');

let autoUpdater = null;
let mainWindowRef = null;
let updateAvailable = null;

// الخادم الافتراضي: GitHub Releases (يعمل لكل المستخدمين بلا إعدادات)
const DEFAULT_GITHUB_FEED = { provider: 'github', owner: 'javamicrosystem2-gif', repo: 'proquote' };

// تفعيل التحديث التلقائي
// feedUrl (اختياري): خادم مخصص من إعدادات المستخدم — وإلا GitHub الافتراضي
function init(mainWindow, feedUrl) {
  mainWindowRef = mainWindow;
  try {
    autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.autoDownload = false;        // عدم التنزيل التلقائي (المستخدم يقرر)
    autoUpdater.autoInstallOnAppQuit = true;  // تثبيت عند الإغلاق إن نُزّل
    // في وضع التطوير: اسمح بالفحص عبر dev-app-update.yml (اختبار التحديثات محلياً)
    try { if (!app.isPackaged) autoUpdater.forceDevUpdateConfig = true; } catch (_) {}
    autoUpdater.setFeedURL(feedUrl || DEFAULT_GITHUB_FEED);

    // ربط الأحداث
    autoUpdater.on('checking-for-update', () => {
      sendToWindow('update-status', { status: 'checking' });
    });
    autoUpdater.on('update-available', (info) => {
      updateAvailable = info;
      sendToWindow('update-status', { status: 'available', version: info.version, releaseNotes: info.releaseNotes });
    });
    autoUpdater.on('update-not-available', (info) => {
      sendToWindow('update-status', { status: 'up-to-date', version: info.version });
    });
    autoUpdater.on('error', (err) => {
      sendToWindow('update-status', { status: 'error', error: err.message });
    });
    autoUpdater.on('download-progress', (progress) => {
      sendToWindow('update-status', {
        status: 'downloading',
        percent: Math.round(progress.percent),
        transferred: progress.transferred,
        total: progress.total
      });
    });
    autoUpdater.on('update-downloaded', (info) => {
      sendToWindow('update-status', { status: 'downloaded', version: info.version });
    });

    console.log('[updater] تم التهيئة بنجاح');
    return true;
  } catch (err) {
    console.error('[updater] فشل التهيئة:', err.message);
    return false;
  }
}

function sendToWindow(channel, data) {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(channel, data);
  }
}

// التحقق اليدوي من التحديثات
async function checkForUpdates() {
  if (!autoUpdater) {
    return { status: 'disabled', message: 'التحديث التلقائي غير مُهيَّأ (يتطلب خادم تحديثات)' };
  }
  try {
    await autoUpdater.checkForUpdates();
    return { status: 'checking' };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

// تنزيل التحديث المتاح
async function downloadUpdate() {
  if (!autoUpdater || !updateAvailable) {
    return { status: 'no-update' };
  }
  try {
    // نسخة احتياطية قبل التحديث (حماية البيانات)
    db.forceFlush();
    try { db.autoBackup(); } catch {}
    await autoUpdater.downloadUpdate();
    return { status: 'downloading' };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

// تثبيت التحديث المنزّل (يُعيد التشغيل)
function quitAndInstall() {
  if (!autoUpdater) return false;
  // حفظ نهائي قبل التثبيت + تجاوز حوار الخروج (إعادة التشغيل مقصودة)
  try { db.forceFlush(); } catch {}
  try { if (mainWindowRef && !mainWindowRef.isDestroyed()) mainWindowRef.__forceClose = true; } catch (_) {}
  autoUpdater.quitAndInstall(true, true);
  return true;
}

// ---------- معالجات IPC ----------
function registerIpc() {
  ipcMain.handle('updater:check', () => checkForUpdates());
  ipcMain.handle('updater:download', () => downloadUpdate());
  ipcMain.handle('updater:install', () => quitAndInstall());
  ipcMain.handle('updater:status', () => ({ updateAvailable, autoUpdaterReady: !!autoUpdater }));
}

module.exports = { init, checkForUpdates, downloadUpdate, quitAndInstall, registerIpc };
