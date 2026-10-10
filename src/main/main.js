// ============================================================
// ProQuote — Electron Main Process
// العملية الرئيسية: إدارة النافذة، القوائم، وجسر IPC
// ============================================================

const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// ضمان اسم موحّد لمجلد بيانات المستخدم (ProQuote بحرف كبير)
app.setName('ProQuote');

// وضع حاصاد لقطات التسويق (--shoot): بيانات تجرية معزولة في TEMP — لا يلمس بيانات المستخدم
const SHOOT_MODE = process.argv.includes('--shoot');
if (SHOOT_MODE) {
  try { require('./shoot').isolateUserData(); } catch (e) { console.error('[shoot] isolation failed:', e.message); }
}
// لغة التسطيب المختارة (يكتبها NSIS في lang.txt بجذر التثبيت)
// ===== جسر الفاتورة الإلكترونية (شبكة + توقيع خارجي) =====
const https = require('https');
ipcMain.handle('ei:request', async (_e, opts) => new Promise((resolve, reject) => {
  try {
    const u = new URL(opts.url);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: opts.method || 'GET', headers: opts.headers || {} }, (res) => {
      let b = '';
      res.on('data', (d) => { b += d; });
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: b }));
    });
    req.on('error', (e) => reject(e.message));
    if (opts.body) req.write(opts.body);
    req.end();
  } catch (e) { reject(e.message); }
}));
ipcMain.handle('ei:sign', async (_e, signerPath, docJson) => new Promise((resolve) => {
  try {
    const { execFile } = require('child_process');
    const os = require('os');
    const path = require('path');
    const tmp = path.join(os.tmpdir(), 'pq_ei_' + Date.now() + '.json');
    require('fs').writeFileSync(tmp, docJson, 'utf8');
    execFile(signerPath, [tmp], { timeout: 30000 }, (err, stdout) => {
      try { require('fs').unlinkSync(tmp); } catch (_) {}
      if (err) resolve({ ok: false, error: err.message }); else resolve({ ok: true, out: stdout });
    });
  } catch (e) { resolve({ ok: false, error: e.message }); }
}));

ipcMain.handle('app:install-lang', () => {
  try {
    const candidates = [path.join(app.getAppPath(), '..', '..', 'lang.txt'), path.join(process.resourcesPath || '', 'lang.txt')];
    for (const p of candidates) {
      try {
        const v = fs.readFileSync(p, "utf8").trim();
        if (v) {
          const n = parseInt(v, 10);
          if([1025,2049,3073,4097,5121,6145,7169,8193,9217,11265,12289,13313,14337,15361,16385,17417,18441].indexOf(n)>=0)return 'ar';return 'en';
          return "en";
        }
      } catch (_) {}
    }
  } catch (_) {}
  return null;
});


const db = require('./db');
const migration = require('./migration');
const license = require('./license');
const updater = require('./updater');
const productImport = require('./product-import');
const filestore = require('./filestore');
const dataMigrations = require('./data-migrations');

// منع فتح أكثر من نافذة رئيسية
let mainWindow = null;

// إعدادات النافذة الرئيسية
const WINDOW_CONFIG = {
  width: 1380,
  height: 850,
  minWidth: 1100,
  minHeight: 680,
  title: 'ProQuote — نظام عروض الأسعار',
  backgroundColor: '#060b14',
  show: false, // إظهار عند جاهزية التحميل (يمنع الوميض الأبيض)
  icon: path.join(__dirname, '..', '..', 'build', 'icon.ico'),
  autoHideMenuBar: true,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,      // عزل سياق المعالجة (أمان)
    nodeIntegration: false,      // تعطيل Node في الواجهة (أمان)
    sandbox: false,              // السماح للـ preload بالوصول لـ Node
    spellcheck: false,
    webSecurity: true
  }
};

// فتح واتساب ديسكتوب (whatsapp://) إن كان مثبتاً، وإلا المتصفح
async function openTelegramLink(webUrl) {
  try {
    // تيليجرام سطح المكتب أولاً — إن كان مثبتاً يفتح tg://msg_url مباشرة
    const appName = await Promise.resolve(app.getApplicationNameForProtocol('tg://')).catch(() => '');
    if (appName && String(appName).trim()) {
      let text = '', u2 = '';
      try { const u = new URL(webUrl); text = u.searchParams.get('text') || ''; u2 = u.searchParams.get('url') || ''; } catch (_) {}
      const q = [];
      if (u2) q.push('url=' + encodeURIComponent(u2));
      if (text) q.push('text=' + encodeURIComponent(text));
      const tg = 'tg://msg_url' + (q.length ? '?' + q.join('&') : '');
      const ok = await shell.openExternal(tg).then(() => true).catch(() => false);
      if (ok) return;
    }
  } catch (_) {}
  // البديل: مشاركة web.telegram عبر المتصفح الافتراضي
  shell.openExternal(webUrl).catch(() => {});
}

async function openWhatsAppLink(webUrl) {
  try {
    let ph = '', txt = '';
    try { const u = new URL(webUrl); ph = (u.pathname || '').replace(/\D/g, ''); txt = u.searchParams.get('text') || ''; } catch (_) {}
    const q = [];
    if (ph) q.push('phone=' + ph);
    if (txt) q.push('text=' + encodeURIComponent(txt));
    const wa = 'whatsapp://send' + (q.length ? '?' + q.join('&') : '');
    const appName = await Promise.resolve(app.getApplicationNameForProtocol('whatsapp://')).catch(() => '');
    if (appName && String(appName).trim()) {
      const ok = await shell.openExternal(wa).then(() => true).catch(() => false);
      if (ok) return;
    }
  } catch (_) {}
  shell.openExternal(webUrl).catch(() => {});
}

function createMainWindow() {
  mainWindow = new BrowserWindow(WINDOW_CONFIG);

  // تحميل ملف الواجهة الرئيسي
  const indexPath = path.join(__dirname, '..', 'renderer', 'index.html');
  mainWindow.loadFile(indexPath);

  // إظهار النافذة عند اكتمال التحميل لتجنب الوميض
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // فتح الروابط الخارجية في المتصفح الافتراضي بدل نافذة Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('whatsapp://')) { shell.openExternal(url).catch(() => {}); return { action: 'deny' }; }
    if (url.startsWith('tg://')) { shell.openExternal(url).catch(() => {}); return { action: 'deny' }; }
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      if (url.includes('wa.me')) { openWhatsAppLink(url); } else if (url.includes('t.me/') || url.includes('web.telegram.org')) { openTelegramLink(url); } else { shell.openExternal(url); }
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // السماح بالكاميرا لقارئ QR في المزامنة (وسائط فقط)
  mainWindow.webContents.session.setPermissionRequestHandler((wc, permission, callback) => {
    callback(permission === 'media');
  });

  // تحذير الخروج بالبيانات غير المحفوظة: نسأل الواجهة إن كانت هناك تعديلات
  mainWindow.on('close', (e) => {
    if (mainWindow.__forceClose) return;
    e.preventDefault();
    Promise.resolve()
      .then(() => mainWindow.webContents.executeJavaScript('window.pqDirtyCheck ? window.pqDirtyCheck() : false', true))
      .then(async (dirty) => {
        if (!dirty) { mainWindow.__forceClose = true; mainWindow.close(); return; }
        const r = await dialog.showMessageBox(mainWindow, {
          type: 'question', title: 'حفظ قبل الإغلاق',
          message: 'لديك تعديلات غير محفوظة. ماذا تريد أن تفعل؟',
          detail: 'اختر «البقاء والحفظ» للعودة للبرنامج وحفظ عملك يدوياً، أو «الخروج دون حفظ» لإغلاق البرنامج فوراً مع فقدان التعديلات غير المحفوظة.',
          buttons: ['البقاء والحفظ', 'الخروج دون حفظ'], defaultId: 1, cancelId: 1, noLink: true
        });
        if (r.response === 1) { mainWindow.__forceClose = true; mainWindow.close(); }
      })
      .catch(() => { mainWindow.__forceClose = true; mainWindow.close(); });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// القائمة العلوية (مبسّطة)
function buildMenu() {
  const isDev = process.env.NODE_ENV === 'development';
  const template = [
    {
      label: 'ملف',
      submenu: [
        { label: 'عرض جديد (Ctrl+N)', accelerator: 'Ctrl+N', click: () => mainWindow?.webContents.send('menu-new-quote') },
        { type: 'separator' },
        { role: 'quit', label: 'خروج' }
      ]
    },
    {
      label: 'تحرير',
      submenu: [
        { role: 'undo', label: 'تراجع' },
        { role: 'redo', label: 'إعادة' },
        { type: 'separator' },
        { role: 'cut', label: 'قص' },
        { role: 'copy', label: 'نسخ' },
        { role: 'paste', label: 'لصق' },
        { role: 'selectAll', label: 'تحديد الكل' }
      ]
    },
    {
      label: 'عرض',
      submenu: [
        { role: 'reload', label: 'إعادة تحميل' },
        { role: 'togglefullscreen', label: 'ملء الشاشة' },
        ...(isDev ? [{ role: 'toggleDevTools', label: 'أدوات المطور' }] : [])
      ]
    },
    {
      label: 'مساعدة',
      submenu: [
        { label: 'التحقق من التحديثات', click: async () => {
          const r = await updater.checkForUpdates();
          if (r.status === 'disabled') {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'التحديثات',
              message: 'التحديث التلقائي',
              detail: r.message + '\n\nلتفعيل التحديثات، يجب ربط التطبيق بخادم تحديثات عند التوزيع التجاري.',
              buttons: ['موافق']
            });
          } else if (r.status === 'checking') {
            // النتيجة تصل عبر IPC للواجهة
          }
        }},
        { type: 'separator' },
        { label: 'حول ProQuote', click: () => {
          const { dialog } = require('electron');
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'حول ProQuote',
            message: 'ProQuote',
            detail: `نظام إدارة عروض الأسعار والمستندات\nالإصدار: ${app.getVersion()}\n\n© 2026 ProQuote`,
            buttons: ['موافق'],
            icon: path.join(__dirname, '..', '..', 'build', 'icon.ico')
          });
        }}
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- دورة حياة التطبيق ----------
app.whenReady().then(() => {
  // وضع الالتقاط: نافذة مستقلة + جولتان (عربي/إنجليزي) ثم خروج — بلا أي أثر جانبي
  if (SHOOT_MODE) {
    require('./shoot').run();
    return;
  }

  createMainWindow();
  buildMenu();

  // تهيئة التحديث التلقائي (خامل حتى يُحدَّد خادم التحديثات)
  // ضع رابط خادمك هنا عند التوفر، مثلاً:
  // updater.init(mainWindow, { provider: 'generic', url: 'https://yourserver.com/proquote/updates/' });
  // رابط التحديثات من إعدادات المستخدم (تبويب المزامنة)
  let _updFeed = null;
  try { const _s = JSON.parse(db.getItem('pq5_s') || 'null'); if (_s && _s.updateFeed) _updFeed = { provider: 'generic', url: _s.updateFeed }; } catch (_) {}
  updater.init(mainWindow, _updFeed);
  updater.registerIpc();
  productImport.registerIpc();
  filestore.init();
  try { const _dm = dataMigrations.init(); console.log('[startup] data migrations:', JSON.stringify(_dm.health)); } catch (e) { console.error('[startup] data migrations error:', e.message); }

  // التحقق من وجود بيانات قديمة للترحيل (بعد إعداد النافذة بقليل)
  setTimeout(() => migration.checkAndOffer(mainWindow), 1500);

  // نسخة احتياطية تلقائية عند بدء التشغيل (مرة يومياً)
  scheduleAutoBackup();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

// نسخة احتياطية تلقائية يومياً (تتحقق من تاريخ آخر نسخة)
function scheduleAutoBackup() {
  // انتظر 8 ثوانٍ بعد البدء لإعطاء الواجهة وقتاً لمزامنة localStorage → ملف البيانات
  setTimeout(() => {
    try {
      const today = new Date().toDateString();
      const backups = db.listBackups();
      const autoToday = backups.find(b => b.name.startsWith('auto-') && new Date(b.mtime).toDateString() === today);
      if (!autoToday) {
        db.autoBackup();
      }
      // جدولة إعادة الفحص كل ساعة (في حال بقي التطبيق مفتوحاً عدة أيام)
      setInterval(() => {
        try {
          const now = new Date().toDateString();
          const has = db.listBackups().some(b => b.name.startsWith('auto-') && new Date(b.mtime).toDateString() === now);
          if (!has) db.autoBackup();
        } catch (e) { console.error('[main] فشل النسخ التلقائي المجدول:', e.message); }
      }, 60 * 60 * 1000); // كل ساعة
    } catch (err) {
      console.error('[main] فشل جدولة النسخ التلقائي:', err.message);
    }
  }, 8000);
}

// حفظ قبل الإغلاق
app.on('before-quit', () => {
  try { db.forceFlush(); } catch {}
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- قناة IPC للجسر (تمهيد للمراحل القادمة) ----------
// إرجاع إصدار التطبيق
ipcMain.handle('app:get-version', () => app.getVersion());

// مسار بيانات المستخدم (للاستخدام المستقبلي في قاعدة البيانات والنسخ الاحتياطي)
ipcMain.handle('app:get-user-data-path', () => app.getPath('userData'));

// إظهار حوار حفظ ملف (للاستخدام في النسخ الاحتياطي/تصدير PDF لاحقاً)
ipcMain.handle('dialog:show-save', async (_evt, opts) => {
  const { dialog } = require('electron');
  const result = await dialog.showSaveDialog(mainWindow, opts || {});
  return result;
});

// إظهار حوار فتح ملف
ipcMain.handle('dialog:show-open', async (_evt, opts) => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, opts || {});
  return result;
});

// ---------- قناة IPC للتخزين الدائم (db.js) ----------
// محاكاة localStorage على القرص — توافق تام مع دوال الواجهة الأصلية
ipcMain.handle('storage:getItem', (_evt, key) => db.getItem(key));
ipcMain.handle('storage:setItem', (_evt, key, value) => { db.setItem(key, value); return true; });
ipcMain.handle('storage:removeItem', (_evt, key) => { db.removeItem(key); return true; });
ipcMain.handle('storage:has', (_evt, key) => db.has(key));
ipcMain.handle('storage:keys', () => db.keys());
ipcMain.handle('storage:clear', () => { db.clear(); return true; });
ipcMain.handle('storage:flush', () => { db.forceFlush(); return true; });
ipcMain.handle('storage:stats', () => db.stats());
ipcMain.handle('storage:getMeta', () => db.getMeta());

// ---------- النسخ الاحتياطي والاستعادة ----------
ipcMain.handle('backup:create', async (_evt, customPath) => {
  let destPath = customPath;
  if (!destPath) {
    const ts = new Date().toISOString().split('T')[0];
    const result = await require('electron').dialog.showSaveDialog(mainWindow, {
      title: 'حفظ نسخة احتياطية',
      defaultPath: `proquote_backup_${ts}.pqbak`,
      filters: [{ name: 'ProQuote Backup', extensions: ['pqbak'] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    destPath = result.filePath;
  }
  try {
    const res = db.createBackup(destPath, false);
    return { success: true, ...res };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backup:restore', async (_evt, srcPath) => {
  let filePath = srcPath;
  if (!filePath) {
    const result = await require('electron').dialog.showOpenDialog(mainWindow, {
      title: 'استعادة من نسخة احتياطية',
      filters: [{ name: 'ProQuote Backup', extensions: ['pqbak'] }, { name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) return { canceled: true };
    filePath = result.filePaths[0];
  }
  try {
    const res = db.restoreBackup(filePath);
    return { success: true, ...res };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backup:list', () => db.listBackups());
ipcMain.handle('backup:auto', () => { const p = db.autoBackup(); return { success: !!p, path: p }; });

// ---------- الترحيل التلقائي (localStorage → ملف البيانات) ----------
ipcMain.handle('migration:check', () => migration.detectLegacyData());
ipcMain.handle('migration:run', (_evt, source) => migration.runMigration(source, mainWindow));
ipcMain.handle('migration:status', () => migration.getStatus());

// ---------- التصدير/الاستيراد (توافق مع expAll/impAll الأصليين) ----------
// يعمل على ملف البيانات الدائم مباشرة
ipcMain.handle('export:all', () => {
  const data = db.getAll();
  return data; // الواجهة تبني JSON الكامل وتُحمّله
});

ipcMain.handle('import:all', (_evt, dataObj) => {
  db.replaceAll(dataObj);
  return { success: true, keyCount: Object.keys(dataObj).length };
});

// ---------- الترخيص ----------
ipcMain.handle('license:getState', () => license.getState());
ipcMain.handle('license:isLicensed', () => license.isLicensed());
ipcMain.handle('license:activate', (_evt, key) => license.activate(key));
ipcMain.handle('license:deviceId', () => license.getShortDeviceId());
ipcMain.handle('license:hasFeature', (_evt, feature) => license.hasFeature(feature));
ipcMain.handle('license:getTier', () => license.getTier());
ipcMain.handle('license:features', () => license.getAvailableFeatures());


// منع إنشاء نوافذ عرض إضافية غير مرغوبة تلقائياً
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (e) => e.preventDefault());
});
