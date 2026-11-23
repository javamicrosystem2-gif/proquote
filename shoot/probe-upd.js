// ============================================================
// ProQuote — فحص تجربة التحديث (--probe-upd)
// زر «تحقق الآن» + الإصدار الديناميكي ببطاقة «حول» + إظهار
// الأخطاء + إلغاء الكتم بالفحص اليدوي.
// ============================================================
'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const REPORT = path.join(os.tmpdir(), 'pq-probe-upd-report.txt');

function isolate() {
  const dir = path.join(os.tmpdir(), 'pq-probe-upd-data');
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  fs.mkdirSync(dir, { recursive: true });
  app.setPath('userData', dir);
}

async function run() {
  const out = [];
  const log = (s) => { out.push(s); console.log(s); };
  const R = (name, ok, extra) => log((ok ? '✅ ' : '✗ ') + name + (extra ? ' — ' + extra : ''));

  try {
    const win = new BrowserWindow({
      width: 1380, height: 850, show: true,
      webPreferences: { preload: path.join(__dirname, '..', 'src', 'main', 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false }
    });
    const wc = win.webContents;
    // تهيئة المحدِّث داخل الفاحص (أنماط الفحص تعود قبل تهيئته في main.js)
    try { const upd = require('../src/main/updater'); upd.init(win, null); upd.registerIpc(); } catch (e) { console.log('[probe-upd] updater init fail:', e.message); }
    const js = (code) => wc.executeJavaScript(code, true);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    await wc.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
    await sleep(4000);
    await js(`(function(){try{document.getElementById('loginScreen').style.display='none'}catch(e){} return true})()`);
    await js(`(function(){go('settings');return true})()`);
    await sleep(1200);

    // 1) الإصدار الديناميكي ببطاقة «حول» (كان ثابتاً 9.7.0)
    await js(`(function(){stab('about');return true})()`);
    await sleep(600);
    let t = await js(`(function(){return document.getElementById('aboutVer').textContent})()`);
    const curVer = await js('(function(){return window.proquote.getVersion().then(function(v){return v})})()');
    R('بطاقة «حول» تعرض الإصدار الحقيقي ديناميكياً', t === curVer && /^\d+\.\d+/.test(t), t + ' (المتوقع ' + curVer + ')');
    t = await js(`(function(){return document.querySelectorAll('[onclick="updCheckNow()"]').length})()`);
    R('زرّا «تحقق من التحديثات الآن»: بالمزامنة وببطاقة حول', Number(t) >= 2, t + ' أزرار');

    // 2) الفحص اليدوي: يظهر النتيجة الصريحة (أحدث إصدار لأن النسخة الحالية = المنشورة)
    await js(`(function(){stab('sync');updCheckNow();return true})()`);
    let res = null;
    for (let i = 0; i < 50; i++) {
      res = await js(`(function(){return document.getElementById('updManualStat').textContent})()`);
      if (res && res.indexOf('جارٍ') < 0) break;
      await sleep(600);
    }
    R('الفحص اليدوي يعيد نتيجة صريحة بلا تعليق', !!res && res.indexOf('جارٍ') < 0, res || '');

    // 3) إلغاء الكتم: بعد «لاحقاً»، الفحص اليدوي يعيد إظهار البانر عند توفر تحديث
    const hid = await js("(function(){updRender({status:'available',version:'9.99.0'});updHide();var b=document.getElementById('updBanner');return b.style.display==='none'})()");
    await js("(function(){updCheckNow();return true})()");
    await sleep(3000); // انتظار استقرار نتيجة الفحص الفعلي (حدث checking المتأخر من IPC)
    await js("(function(){updRender({status:'available',version:'9.99.0'});return true})()");
    t = await js(`(function(){var b=document.getElementById('updBanner');return JSON.stringify({shown:b.style.display!=='none',txt:(document.getElementById('updTxt').textContent||'')})})()`);
    const r3 = JSON.parse(t || '{}');
    R('بعد «لاحقاً»: الفحص اليدوي يُلغي الكتم ويُظهر البانر', r3.shown === true && r3.txt.indexOf('9.99.0') >= 0, t);
    await js(`(function(){updHide();return true})()`);

    // 4) أخطاء الفحص مرئية ببانر أحمر (كانت تُخفى صامتة)
    await js(`(function(){updRender({status:'error',error:'فشل الاتصال بالشبكة (اختبار)'});return true})()`);
    t = await js(`(function(){var b=document.getElementById('updBanner');return JSON.stringify({shown:b.style.display!=='none',txt:(document.getElementById('updTxt').textContent||''),red:b.style.borderColor})})()`);
    const r4 = JSON.parse(t || '{}');
    R('خطأ الفحص يظهر ببانر أحمر مع السبب', r4.shown === true && r4.txt.indexOf('فشل الاتصال') >= 0, t);
    await js(`(function(){updHide();try{document.getElementById('updBanner').style.borderColor='var(--acc)'}catch(e){};return true})()`);

    // ===== v3: حصانة البانر — التسلسلات القاتلة =====
    // أ) متاح ← خطأ لاحق: البانر يبقى بزر «تحميل الآن»
    await js("(function(){_updDismissed=false;_updShown=false;updRender({status:'available',version:'9.99.0'});updRender({status:'error',error:'انقطاع شبكة (اختبار)'});return true})()");
    t = await js("(function(){var b=document.getElementById('updBanner');return JSON.stringify({shown:b.style.display!=='none',txt:(document.getElementById('updTxt').textContent||''),hasDl:Array.from(b.querySelectorAll('button')).some(function(x){return (x.getAttribute('onclick')||'').indexOf('download')>=0})})})()");
    const ra = JSON.parse(t || '{}');
    R('متاح ← خطأ لاحق: البانر يبقى وزر «تحميل الآن» يعمل (قاتل المشكلة)', ra.shown === true && ra.hasDl === true && ra.txt.indexOf('متاح') >= 0, t);

    // ب) متاح ← فحص جديد (checking): لا يُمسح ولا تنزع أزراره
    await js("(function(){updRender({status:'available',version:'9.99.0'});updRender({status:'checking'});return true})()");
    t = await js("(function(){var b=document.getElementById('updBanner');return JSON.stringify({txt:(document.getElementById('updTxt').textContent||''),hasDl:Array.from(b.querySelectorAll('button')).some(function(x){return (x.getAttribute('onclick')||'').indexOf('download')>=0})})})()");
    const rb = JSON.parse(t || '{}');
    R('متاح ← جارٍ التحقق لاحقاً: يُتجاهل ويبقى الزر', rb.hasDl === true && rb.txt.indexOf('متاح') >= 0, t);

    // ج) متاح ← up-to-date لاحق: يُتجاهل والبانر يبقى
    await js("(function(){updRender({status:'available',version:'9.99.0'});updRender({status:'up-to-date',version:'9.99.0'});return true})()");
    t = await js("(function(){var b=document.getElementById('updBanner');return JSON.stringify({shown:b.style.display!=='none',hasDl:Array.from(b.querySelectorAll('button')).some(function(x){return (x.getAttribute('onclick')||'').indexOf('download')>=0})})})()");
    const rc = JSON.parse(t || '{}');
    R('متاح ← up-to-date لاحق: يُتجاهل والبانر يبقى (كان يمسحه تماماً)', rc.shown === true && rc.hasDl === true, t);
    await js("(function(){updHide();return true})()");

    // د) بانر الخطأ يحمل «إعادة المحاولة»
    await js("(function(){_updShown=false;updRender({status:'error',error:'اختبار'});return true})()");
    t = await js("(function(){var b=document.getElementById('updBanner');return Array.from(b.querySelectorAll('button')).some(function(x){return (x.getAttribute('onclick')||'').indexOf('updCheckNow')>=0})})()");
    R('بانر الخطأ يحمل زر «إعادة المحاولة»', t === true);
    await js("(function(){updHide();return true})()");

    // 5) الدورية: كل ساعة (كانت 6)
    const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'main.js'), 'utf8');
    R('الفحص الدوري: كل ساعة بدل 6 ساعات', mainSrc.includes('60 * 60 * 1000') && !mainSrc.includes('6 * 60 * 60 * 1000'));

    const pass = out.filter((l) => l.startsWith('✅')).length;
    const fail = out.filter((l) => l.startsWith('✗')).length;
    log('===== PROBE UPD: ' + pass + ' PASS / ' + fail + ' FAIL =====');
    await sleep(400);
    win.destroy();
    try { fs.writeFileSync(REPORT, out.join('\n'), 'utf8'); } catch (_) {}
    app.exit(fail ? 1 : 0);
  } catch (e) {
    log('✗ فشل الفاحص: ' + (e && e.message));
    try { fs.writeFileSync(REPORT, out.join('\n'), 'utf8'); } catch (_) {}
    app.exit(1);
  }
}

module.exports = { isolate, run };
