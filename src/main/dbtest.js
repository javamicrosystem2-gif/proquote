// ============================================================
// ProQuote — فحص التخزين التشخيصي (--dbtest)
// يعمل بلا نافذة ويكتب تقريراً نصياً في userData/dbtest-report.txt
// الفحوصات: الترحيل من JSON + التكافؤ الحرفي (SHA-256) +
// دورة النسخ الاحتياطي ذهاباً وإياباً + ثبات الإقلاع المتكرر
// الاستخدام: npx electron . --dbtest   (اختياري: PQTEST_USERDATA=<مجلد>)
// ============================================================
'use strict';

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const sha = (obj) => crypto.createHash('sha256')
  .update(JSON.stringify(obj, Object.keys(obj).sort(), 2)).digest('hex');

function run() {
  const lines = [];
  const log = (s) => { lines.push(s); console.log(s); };
  const db = require('./db');

  try {
    const jsonPath = path.join(app.getPath('userData'), 'proquote.data.json');

    // ---------- 1) لقطة الأصل قبل الفتح (لو وُجد) ----------
    let original = null;
    if (fs.existsSync(jsonPath)) {
      try { original = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch (e) { log('✗ ملف JSON الأصلي غير قابل للقراءة: ' + e.message); }
    }

    // ---------- 2) الفتح (يشغّل الترحيل تلقائياً إن لزم) ----------
    db.open();
    const migrated = !!original;
    log('— الفتح: تم (محرك ' + (db.getMeta().engine || '?') + ')');
    log('— الترحيل من JSON: ' + (migrated ? 'نُفّذ الآن' : 'غير مطلوب (سبق أو أول تشغيل)'));

    // ---------- 3) التكافؤ الحرفي ----------
    const now = db.getAll();
    const keyCount = Object.keys(now).length;
    log('— عدد المفاتيح في القاعدة: ' + keyCount);
    if (original) {
      const oKeys = Object.keys(original);
      let same = oKeys.length === keyCount;
      const diffs = [];
      if (same) {
        for (const k of oKeys) {
          if (String(original[k]) !== String(now[k])) { diffs.push(k); same = false; if (diffs.length > 3) break; }
        }
      }
      log('— التكافؤ مع JSON الأصلي: ' + (same ? '✅ متطابق 100%' : '✗ اختلاف! ' + diffs.join(', ')));
      const hO = sha(original), hN = sha(now);
      log('— بصمة SHA-256 الأصل : ' + hO.slice(0, 16) + '…');
      log('— بصمة SHA-256 القاعدة: ' + hN.slice(0, 16) + '…');
      log('— البصمتان متطابقتان: ' + (hO === hN ? '✅ نعم' : '✗ لا'));
    }

    // ---------- 4) النسخ الاحتياطي ذهاباً وإياباً ----------
    const bakPath = path.join(app.getPath('userData'), 'dbtest-roundtrip.pqbak');
    db.createBackup(bakPath, false);
    db.replaceAll({ __dbtest_wiped__: '1' }); // مسح كامل
    const afterWipe = Object.keys(db.getAll()).length;
    db.restoreBackup(bakPath);
    const afterRestore = db.getAll();
    const roundTripOk = sha(afterRestore) === (original ? sha(original) : sha(now)) && afterWipe === 1;
    log('— نسخ احتياطي → مسح → استعادة: ' + (roundTripOk ? '✅ مطابقة كاملة' : '✗ خلل!'));
    try { fs.unlinkSync(bakPath); } catch (_) {}

    // ---------- 5) ثبات الكتابة عبر إعادة الفتح ----------
    db.setItem('__dbtest_sentinel__', 'قيمة-اختبار-' + Date.now());
    const sent = db.getItem('__dbtest_sentinel__');
    log('— كتابة/قراءة فورية: ' + (sent && sent.startsWith('قيمة-اختبار-') ? '✅' : '✗ فشلت'));

    // ---------- 6) نظافة المفاتيح التجريبية ----------
    db.removeItem('__dbtest_sentinel__');
    db.removeItem('__dbtest_wiped__');
    const finalCount = Object.keys(db.getAll()).length;
    log('— مفاتيح نهائية بعد التنظيف: ' + finalCount);

    // ---------- 7) نتيجة الملف المؤرشف ----------
    const archived = fs.readdirSync(app.getPath('userData')).find(f => f.startsWith('proquote.data.json.imported-'));
    log('— ملف JSON مؤرشف (لم يُحذف): ' + (archived || (migrated ? '✗ غير موجود!' : 'غير مطلوب')));

    const meta = db.getMeta();
    log('— ملف القاعدة: ' + path.basename(meta.dataPath) + ' (' + Math.round(meta.totalBytes / 1024) + 'KB بيانات، ' + Math.round((fs.statSync(meta.dataPath).size || 0) / 1024) + 'KB ملف)');
    log('===' + (keyCount > 0 ? '✅ اكتمل الفحص بنجاح' : '⚠ القاعدة فارغة (أول تشغيل؟)') + '===');
  } catch (e) {
    log('✗✗ فشل الفحص: ' + e.message + '\n' + e.stack);
  }

  const report = path.join(app.getPath('userData'), 'dbtest-report.txt');
  try { fs.writeFileSync(report, lines.join('\n'), 'utf8'); } catch (_) {}
  app.exit(0);
}

module.exports = { run };
