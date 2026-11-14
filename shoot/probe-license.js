// ============================================================
// ProQuote — الفحص العملي لنظام التراخيص (--probe-license)
// سلسلة كاملة أوفلاين: سيرفر وهمي → شاشة القفل → تفعيل باقة →
// إضافة باقة ثانية → تجديد → رفض جهاز خاطئ → لوحة المطور تولّد
// كوداً مقفولاً على الجهاز → التطبيق يفعّله. لا يلمس الإنتاج.
// ============================================================
'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const mock = require('./mock-license-server');

const HOME_LIC = path.join(os.homedir(), '.proquote', '.license');
const HOME_LIC_BAK = HOME_LIC + '.probe-bak';
const REPORT = path.join(os.tmpdir(), 'pq-probe-license-report.txt');

function isolate() {
  const dir = path.join(os.tmpdir(), 'pq-probe-license-data');
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  fs.mkdirSync(dir, { recursive: true });
  app.setPath('userData', dir);
}

async function run() {
  const out = [];
  const log = (s) => { out.push(s); console.log(s); };
  const R = (name, ok, extra) => log((ok ? '✅ ' : '✗ ') + name + (extra ? ' — ' + extra : ''));

  // نسخ احتياطي لملف الترخيص الحقيقي في الموقع الثاني (~/.proquote/.license)
  let hadHomeLic = false;
  try { if (fs.existsSync(HOME_LIC)) { fs.copyFileSync(HOME_LIC, HOME_LIC_BAK); hadHomeLic = true; } } catch (_) {}

  const license = require('../src/main/license');
  const finish = async (code) => {
    try {
      if (hadHomeLic) fs.copyFileSync(HOME_LIC_BAK, HOME_LIC);
      else { try { fs.rmSync(HOME_LIC, { force: true }); } catch (_) {} }
      try { fs.rmSync(HOME_LIC_BAK, { force: true }); } catch (_) {}
    } catch (_) {}
    try { fs.writeFileSync(REPORT, out.join('\n'), 'utf8'); } catch (_) {}
    app.exit(code);
  };

  try {
    // 1) سيرفر وهمي + توجيه الترخيص إليه (متغيرات بيئة يقرأها license.js وقت الاستخدام)
    const { pubPem, port, sign } = await mock.start(8791);
    process.env.PQ_LICENSE_PUBKEY = pubPem;
    process.env.PQ_LICENSE_SERVER = 'http://127.0.0.1:' + port + '/activate';

    const deviceId = license.getShortDeviceId();

    // 2) ملف ترخيص بباقة منتهية → الإقلاع على شاشة القفل
    const expiredPayload = JSON.stringify({ deviceId, tier: 'quotes', expiry: Date.now() - 86400000, issued: Date.now() - 400 * 86400000 });
    const env = { v: 2, items: [{ payload: expiredPayload, sig: sign(expiredPayload), timestamp: Date.now() }], timestamp: Date.now() };
    const p1 = path.join(app.getPath('userData'), 'license.dat');
    const p2dir = path.join(os.homedir(), '.proquote');
    fs.mkdirSync(p2dir, { recursive: true });
    fs.writeFileSync(p1, JSON.stringify(env), 'utf8');
    fs.writeFileSync(HOME_LIC, JSON.stringify(env), 'utf8');

    // 3) نافذة التطبيق
    const win = new BrowserWindow({
      width: 1380, height: 850, show: true,
      webPreferences: { preload: path.join(__dirname, '..', 'src', 'main', 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false }
    });
    const wc = win.webContents;
    const js = (code) => wc.executeJavaScript(code, true);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const waitJs = async (code, timeout) => {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        try { const v = await js(code); if (v) return v; } catch (_) {}
        await sleep(300);
      }
      return null;
    };

    await wc.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
    await sleep(4000);
    await js(`(function(){try{document.getElementById('loginScreen').style.display='none'}catch(e){} return true})()`);

    // ===== السيناريو 1: شاشة القفل =====
    let t = await js(`(function(){var lk=document.getElementById('licLock');return lk&&lk.style.display==='flex'})()`);
    R('شاشة القفل ظاهرة عند انتهاء الباقات', t === true);

    t = await js(`(function(){var d=document.getElementById('licLockDid');return d&&/^[A-Z0-9]{8}$/.test(d.textContent.trim())})()`);
    R('معرّف الجهاز ظاهر بالشاشة (8 حروف)', t === true);

    // ===== السيناريو 2: زر الباقات يفتح النافذة فوق القفل =====
    t = await js(`(function(){try{document.querySelector('#licLock .btn-p').click();return true}catch(e){return 'ERR:'+e.message}})()`);
    await sleep(700);
    t = await js(`(function(){var m=document.getElementById('mLicense');var lk=document.getElementById('licLock');var zi=(m)?parseInt(getComputedStyle(m).zIndex):0;var lz=(lk)?parseInt(getComputedStyle(lk).zIndex):0;return JSON.stringify({show:m?m.classList.contains('show'):null,lock:lk?lk.style.display:null,zi:zi,lz:lz})})()`);
    const zr = (() => { try { return JSON.parse(t); } catch (_) { return {}; } })();
    R('زر «مشاهدة الباقات» يفتح النافذة فوق القفل (z-index) والقفل يُخفى', zr.show === true && zr.lock === 'none' && zr.zi > zr.lz, t || '');

    t = await js(`(function(){try{cm('mLicense');return true}catch(e){return 'ERR:'+e.message}})()`);
    await sleep(500);
    t = await js(`(function(){var lk=document.getElementById('licLock');return lk&&lk.style.display==='flex'})()`);
    R('إغلاق النافذة يعيد شاشة القفل تلقائياً', t === true);

    t = await js(`(function(){var tc=document.querySelector('.tc');var lk=document.getElementById('licLock');return tc&&parseInt(getComputedStyle(tc).zIndex)>parseInt(getComputedStyle(lk).zIndex)})()`);
    R('التنبيهات (toasts) فوق طبقة القفل — أخطاء التفعيل مرئية', t === true);

    // ===== السيناريو 3: تفعيل باقة عروض الأسعار من شاشة القفل =====
    await js(`(function(){document.getElementById('licLockKey').value='PQ-TEST-QUOT-0001';return true})()`);
    await js(`(function(){try{licLockActivate();return true}catch(e){return 'ERR:'+e.message}})()`);
    const unlocked = await waitJs(`(function(){var lk=document.getElementById('licLock');return lk&&lk.style.display==='none'})()`, 8000);
    R('تفعيل كود «عروض الأسعار» يفتح القفل', !!unlocked);

    t = await js(`(function(){return window.proquote.license.getState().then(function(s){return s.status==='activated'&&s.tiers.join(',')==='quotes'&&s.message.indexOf('عروض الأسعار')>=0})})()`);
    R('الحالة: مُفعّل — باقة عروض الأسعار فقط', t === true);

    t = await js(`(function(){return window.proquote.license.sections().then(function(secs){return secs.indexOf('quotes')>=0&&secs.indexOf('purchase')>=0&&secs.indexOf('payments')<0&&secs.indexOf('clients')<0&&secs.indexOf('ei')<0})})()`);
    R('أقسام عروض الأسعار مفتوحة والباقي مقفول', t === true);

    t = await js(`(function(){var hidden=0,shown=0;document.querySelectorAll('.sb-it').forEach(function(it){if(it.style.display==='none')hidden++;else shown++});return {hidden:hidden,shown:shown,blocked:!window._secGate('payments'),open:window._secGate('quotes')}})()`);
    R('الشريط الجانبي: أقسام الباقة فقط + بوابة التنقل تعمل', !!(t && t.blocked && t.open && t.hidden > 0), t ? ('مخفي: ' + t.hidden + ' / ظاهر: ' + t.shown) : '');

    // ===== السيناريو 4: إضافة باقة الأمور المالية من نافذة التراخيص =====
    await js(`(function(){try{openLicenseModal();return true}catch(e){return 'ERR:'+e.message}})()`);
    await sleep(700);
    t = await js(`(function(){var box=document.getElementById('licenseStatusBox');var sec=document.getElementById('licenseActivateSection');var btn=document.getElementById('licenseActivateBtn');return box&&box.textContent.indexOf('عروض الأسعار')>=0&&sec.style.display==='block'&&btn.textContent.indexOf('إضافة الباقة')>=0})()`);
    R('النافذة تعرض باقات النشطة + قسم «إضافة الباقة» ظاهر رغم التفعيل', t === true);

    await js(`(function(){document.getElementById('licenseKey').value='PQ-TEST-FINN-0002';return true})()`);
    await js(`(function(){try{doActivate();return true}catch(e){return 'ERR:'+e.message}})()`);
    const added = await waitJs(`(function(){return window.proquote.license.getState().then(function(s){return s.tiers.join(',')==='quotes,finance'})})()`, 8000);
    R('إضافة كود «الأمور المالية» يراكم الباقة (لا يمسح السابقة)', !!added);

    t = await js(`(function(){return window.proquote.license.sections().then(function(secs){return secs.indexOf('payments')>=0&&secs.indexOf('receivables')>=0&&secs.indexOf('rcpt')>=0&&secs.indexOf('quotes')>=0})})()`);
    R('اتحاد الأقسام: عروض الأسعار + الأمور المالية معاً', t === true);

    t = await js(`(function(){return window.proquote.license.getState().then(function(s){return s.packages.length===2&&s.packages[0].name.indexOf('عروض')>=0&&s.packages[1].name.indexOf('المالية')>=0})})()`);
    R('قائمة الباقات النشطة تعرض الاثنتين بأسمائهما العربية', t === true);

    // ===== السيناريو 5: تجديد نفس الباقة بكود ثانٍ =====
    t = await js(`(function(){return window.proquote.license.activate('PQ-TEST-QREN-0003').then(function(r){return r.success&&r.message.indexOf('تجديد')>=0})})()`);
    R('كود ثانٍ لنفس الباقة = تجديد (وليس تكراراً)', t === true);

    t = await js(`(function(){return window.proquote.license.getState().then(function(s){var q=s.packages.filter(function(p){return p.tier==='quotes'});return q.length===1&&s.tiers.indexOf('finance')>=0})})()`);
    R('بعد التجديد: عنصر واحد لعروض الأسعار والأمور المالية بمكانها', t === true);

    // ===== السيناريو 6: الرفض الصحيح للأكواد غير الصالحة =====
    t = await js(`(function(){return window.proquote.license.activate('PQ-TEST-LOCK-0004').then(function(r){return !r.success&&r.error.indexOf('جهاز آخر')>=0})})()`);
    R('كود مقفول على جهاز آخر → رفض برسالة واضحة', t === true);

    t = await js(`(function(){return window.proquote.license.activate('PQ-WRNG-KEY-9999').then(function(r){return !r.success&&r.error.indexOf('غير صحيح')>=0})})()`);
    R('كود غير موجود → رفض', t === true);

    t = await js(`(function(){return window.proquote.license.activate('PQ-TEST-EXPI-0005').then(function(r){return !r.success&&r.error.indexOf('انتهت صلاحية')>=0})})()`);
    R('كود منتهي الصلاحية → رفض', t === true);

    // ===== السيناريو 7: لوحة المطور تولّد كوداً مقفولاً على هذا الجهاز ثم التطبيق يفعّله =====
    const panel = new BrowserWindow({
      width: 1000, height: 800, show: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false }
    });
    await panel.webContents.loadFile(path.join(__dirname, '..', 'admin-panel.html'));
    const pjs = (code) => panel.webContents.executeJavaScript(code, true);
    // الإعدادات تُقرأ عند تحميل الصفحة — نضبطها ثم نعيد التحميل ثم نسجّل الدخول
    await pjs(`(function(){localStorage.setItem('pq_dev_panel', JSON.stringify({srvUrl:'http://127.0.0.1:${port}', srvKey:'test-key'}));return true})()`);
    await panel.webContents.reload();
    await sleep(800);
    await pjs(`(function(){document.getElementById('devPwd').value='AmrNada2026!';devLogin();return true})()`);
    await sleep(500);
    await pjs(`(function(){document.getElementById('genTier').value='mgmt';document.getElementById('genDevice').value='${deviceId}';genKey();return true})()`);
    const genKeyVal = await waitPanelKey(pjs);
    R('اللوحة ولّدت كوداً (v1.2) مقفولاً على معرف الجهاز', !!genKeyVal, genKeyVal || '');
    const rowForGen = mock.getRows().find((r) => r.key === genKeyVal);
    R('الكود محفوظ بالسيرفر الوهمي بـ bound_device = معرف الجهاز', !!(rowForGen && rowForGen.bound_device === deviceId && rowForGen.tier === 'mgmt'));

    t = await js(`(function(){return window.proquote.license.activate('${genKeyVal}').then(function(r){return r.success})})()`);
    R('التطبيق فعّل كود اللوحة: باقة الإدارة أُضيفت', t === true);

    t = await js(`(function(){return window.proquote.license.sections().then(function(secs){return secs.indexOf('clients')>=0&&secs.indexOf('warehouse')>=0&&secs.indexOf('payments')>=0&&secs.indexOf('quotes')>=0})})()`);
    R('اتحاد ثلاث باقات: عروض الأسعار + المالية + الإدارة', t === true);

    // ===== الخلاصة =====
    const pass = out.filter((l) => l.startsWith('✅')).length;
    const fail = out.filter((l) => l.startsWith('✗')).length;
    log('===== PROBE LICENSE: ' + pass + ' PASS / ' + fail + ' FAIL =====');
    await sleep(600);
    panel.destroy(); win.destroy();
    await finish(fail ? 1 : 0);
  } catch (e) {
    log('✗ فشل الفاحص: ' + (e && e.message));
    await finish(1);
  }
}

async function waitPanelKey(pjs) {
  for (let i = 0; i < 20; i++) {
    try {
      const v = await pjs(`(function(){var e=document.getElementById('genKeyVal');return e?e.textContent.trim():''})()`);
      if (v && v.startsWith('PQ-')) return v;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

// ============================================================
// معاينة حية (--lic-preview): نفس إعداد الفاحص + التقاط صور
// والنافذة تبقى مفتوحة لتجربة المشترك بنفسك. أكواد التجربة:
// PQ-TEST-QUOT-0001 (عروض الأسعار) · PQ-TEST-FINN-0002 (المالية)
// PQ-TEST-QREN-0003 (تجديد عروض الأسعار) · PQ-TEST-LOCK-0004 (جهاز آخر)
// ============================================================
async function preview() {
  const license = require('../src/main/license');
  let hadHomeLic = false;
  const H = path.join(os.homedir(), '.proquote', '.license');
  try { if (fs.existsSync(H)) { fs.copyFileSync(H, H + '.probe-bak'); hadHomeLic = true; } } catch (_) {}

  const { pubPem, port, sign } = await mock.start(8791);
  process.env.PQ_LICENSE_PUBKEY = pubPem;
  process.env.PQ_LICENSE_SERVER = 'http://127.0.0.1:' + port + '/activate';
  global._licPreviewRestore = () => {
    try {
      if (hadHomeLic) fs.copyFileSync(H + '.probe-bak', H);
      else fs.rmSync(H, { force: true });
      fs.rmSync(H + '.probe-bak', { force: true });
    } catch (_) {}
  };

  const deviceId = license.getShortDeviceId();
  const expiredPayload = JSON.stringify({ deviceId, tier: 'quotes', expiry: Date.now() - 86400000, issued: Date.now() - 400 * 86400000 });
  const env = { v: 2, items: [{ payload: expiredPayload, sig: sign(expiredPayload), timestamp: Date.now() }], timestamp: Date.now() };
  fs.writeFileSync(path.join(app.getPath('userData'), 'license.dat'), JSON.stringify(env), 'utf8');
  fs.mkdirSync(path.join(os.homedir(), '.proquote'), { recursive: true });
  fs.writeFileSync(H, JSON.stringify(env), 'utf8');

  const OUT = path.join(__dirname, 'preview-license');
  fs.mkdirSync(OUT, { recursive: true });

  const { BrowserWindow } = require('electron');
  const win = new BrowserWindow({
    width: 1380, height: 850, show: true,
    webPreferences: { preload: path.join(__dirname, '..', 'src', 'main', 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false }
  });
  const wc = win.webContents;
  const js = (code) => wc.executeJavaScript(code, true);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const cap = async (n) => { try { const im = await wc.capturePage(); fs.writeFileSync(path.join(OUT, n), im.toPNG()); console.log('[lic-preview] captured', n); } catch (e) { console.log('[lic-preview] capture fail', n, e.message); } };

  await wc.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
  await sleep(4500);
  await js(`(function(){try{document.getElementById('loginScreen').style.display='none'}catch(e){} return true})()`);
  await sleep(400);
  await cap('1-lock-screen.png');
  await js(`(function(){document.querySelector('#licLock .btn-p').click();return true})()`);
  await sleep(1200);
  await cap('2-packages-over-lock.png');
  await js(`(function(){cm('mLicense');return true})()`);
  await sleep(500);
  await js(`(function(){document.getElementById('licLockKey').value='PQ-TEST-QUOT-0001';licLockActivate();return true})()`);
  await sleep(3500);
  await js(`(function(){try{go('quotes')}catch(e){};return true})()`);
  await sleep(800);
  await cap('3-quotes-package-only.png');
  await js(`(function(){openLicenseModal();return true})()`);
  await sleep(1000);
  await js(`(function(){document.getElementById('licenseKey').value='PQ-TEST-FINN-0002';doActivate();return true})()`);
  await sleep(3000);
  await cap('4-two-stacked-packages.png');
  // نترك النافذة مفتوحة: جرّب بنفسك — الكود PQ-TEST-QREN-0003 للتجديد
  win.on('closed', () => { try { global._licPreviewRestore(); } catch (_) {} });
  console.log('[lic-preview] النافذة مفتوحة للتجربة الحية — أغلقها لإنهاء المعاينة');
}

module.exports = { isolate, run, preview };
