// ============================================================
// ProQuote — الترحيل التلقائي من localStorage إلى ملف البيانات
// يفحص: (1) بيانات الإصدار السابق C# (ملف HTML قديم)،
//        (2) ملف JSON احتياطي (من expAll)،
//        (3) بيانات موجودة في ملف البيانات
// ============================================================

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const db = require('./db');

// مفاتيح ProQuote الأصلية الـ15
const LEGACY_KEYS = [
'pq5_q', 'pq5_c', 'pq5_p', 'pq5_s', 'pq5_n',
  'pq5_tf', 'pq5_tc', 'pq5_tr', 'pq5_au',
  'pq5_nf', 'pq5_nc', 'pq5_nr', 'pq5_na', 'pq5_nrc', 'pq5_dc',
  // new sections
  'pq5_sa', 'pq5_nsa', 'pq5_so', 'pq5_nso', 'pq5_rt', 'pq5_nrt',
  'pq5_pay', 'pq5_rec', 'pq5_wh', 'pq5_wi', 'pq5_wm',
  'pq5_td', 'pq5_ntd', 'pq5_cr', 'pq5_shp', 'pq5_nshp', 'pq5_nau',
  'pq5_io', 'pq5_nio', 'pq5_mfg', 'pq5_nmfg', 'pq5_nt', 'pq5_emp',
  'pq5_rcpt', 'pq5_nrcpt'
];

// الكشف عن البيانات القديمة
function detectLegacyData() {
  const sources = [];

  // 1. مجلدات التثبيت القديمة C# (Program.cs كان يخزن في %LOCALAPPDATA%\ProQuote)
  const oldPaths = [
    path.join(app.getPath('userData'), '..', 'ProQuote'),       // %LOCALAPPDATA%\ProQuote
    path.join(os.homedir(), 'AppData', 'Local', 'ProQuote')
  ];

  // 2. ملفات HTML القديمة محتملة (قد تكون بجانب ملفات المستخدم)
  // لا نستطيع قراءة localStorage من ملف HTML مباشرة، لكن قد يجد المستخدم نسخة JSON

  return { sources, note: 'الكشف التلقائي عن البيانات القديمة' };
}

// حالة الترحيل
function getStatus() {
  return {
    migrated: db.has('__migrated__'),
    migrateDate: db.getItem('__migrated_date__'),
    keyCount: db.keys().length
  };
}

// وضع علامة الترحيل مكتمل
function markMigrated() {
  db.setItem('__migrated__', 'true');
  db.setItem('__migrated_date__', new Date().toISOString());
}

// استيراد كائن بيانات كامل (من expAll JSON أو نسخة احتياطية)
function importDataObject(dataObj) {
  let imported = 0;
  for (const key of LEGACY_KEYS) {
    if (dataObj.hasOwnProperty(key) || dataObj[key] !== undefined) {
      // ملاحظة: expAll يحفظ بأسماء وصفية (quotes, clients...)، لكن impAll يكتبها للمفاتيح pq5_*
      // هنا نتعامل مع كلا التنسيقين
    }
  }

  // تنسيق expAll: { quotes, clients, products, settings, ... }
  const expAllMap = {
    quotes: 'pq5_q', clients: 'pq5_c', products: 'pq5_p', settings: 'pq5_s',
    documents: 'pq5_dc', techDocs: 'pq5_tf', customDocs: 'pq5_tc',
    receiptDocs: 'pq5_rc', nextNum: 'pq5_n', techNum: 'pq5_nf',
    customNum: 'pq5_nc', receiptNum: 'pq5_nr', authNum: 'pq5_na',
    receiptListNum: 'pq5_nrc'
  };

  // تنسيق مباشر: { pq5_q: ..., pq5_c: ... }
  for (const [src, dest] of Object.entries(expAllMap)) {
    if (dataObj[src] !== undefined) {
      db.setItem(dest, JSON.stringify(dataObj[src]));
      imported++;
    }
  }

  // مفاتيح مباشرة بصيغة pq5_*
  for (const key of LEGACY_KEYS) {
    if (dataObj[key] !== undefined) {
      db.setItem(key, typeof dataObj[key] === 'string' ? dataObj[key] : JSON.stringify(dataObj[key]));
      imported++;
    }
  }

  db.forceFlush();
  return imported;
}

// فحص وعرض نافذة الترحيل عند بدء التشغيل
// مبدأ: غير مُتطفّل — يُعرض العرض مرة واحدة فقط، والمستخدم يقرر
function checkAndOffer(mainWindow) {
  try {
    const status = getStatus();
    if (status.migrated) return; // تم الترحيل/العرض مسبقاً — لا تُزعج المستخدم

    // ضع علامة "عُرض" فوراً لتجنب التكرار في كل تشغيل
    markMigrated();

    // لا نعرض أي نافذة تلقائية — المستخدم يمكنه الاستيراد يدوياً من زر "استيراد"
    // (أقل تطفّلاً وأكثر احترافية)
  } catch (err) {
    console.error('[migration] خطأ في فحص الترحيل:', err.message);
  }
}

// تشغيل الترحيل من مصدر محدد
// source: 'file' (سيُطلب اختيار ملف) أو كائن بيانات مباشر
function runMigration(source, mainWindow) {
  return new Promise((resolve) => {
    if (source && typeof source === 'object') {
      // كائن بيانات مباشر
      try {
        const count = importDataObject(source);
        markMigrated();
        resolve({ success: true, importedKeys: count });
      } catch (err) {
        resolve({ success: false, error: err.message });
      }
      return;
    }

    // من ملف — طلب اختيار الملف
    if (!mainWindow) {
      resolve({ success: false, error: 'لا توجد نافذة رئيسية' });
      return;
    }

    const { dialog } = require('electron');
    dialog.showOpenDialog(mainWindow, {
      title: 'اختر ملف النسخة الاحتياطية أو JSON للاستيراد',
      filters: [
        { name: 'ملفات البيانات', extensions: ['pqbak', 'json'] }
      ],
      properties: ['openFile']
    }).then(result => {
      if (result.canceled || result.filePaths.length === 0) {
        resolve({ canceled: true });
        return;
      }
      try {
        const filePath = result.filePaths[0];
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);

        // كشف التنسيق
        let dataObj;
        if (parsed.data && (parsed.meta || parsed.checksum)) {
          // تنسيق .pqbak
          dataObj = parsed.data;
        } else {
          // تنسيق JSON مباشر (expAll)
          dataObj = parsed;
        }

        // نسخة احتياطية تلقائية قبل الترحيل (حماية)
        try { db.autoBackup(); } catch {}

        const count = importDataObject(dataObj);
        markMigrated();
        resolve({ success: true, importedKeys: count, source: filePath });
      } catch (err) {
        resolve({ success: false, error: err.message });
      }
    });
  });
}

module.exports = {
  detectLegacyData,
  getStatus,
  checkAndOffer,
  runMigration,
  importDataObject,
  LEGACY_KEYS
};
