// ============================================================
// ProQuote — الفحص العملي لقسم الفاتورة الإلكترونية (--probe-einvoice)
// منظومة وهمية محلية: حفظ مشفّر · فحص اتصال متصل/غير متصل ·
// إرسال مقبول/مرفوض · ملفات متعددة وافتراضي · مؤشرات الواجهة ·
// سجل العمليات · حالة الموقّع.
// ============================================================
'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const mock = require('./mock-einvoice-server');

const REPORT = path.join(os.tmpdir(), 'pq-probe-einvoice-report.txt');

function isolate() {
  const dir = path.join(os.tmpdir(), 'pq-probe-einvoice-data');
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  fs.mkdirSync(dir, { recursive: true });
  app.setPath('userData', dir);
}

async function run() {
  const out = [];
  const log = (s) => { out.push(s); console.log(s); };
  const R = (name, ok, extra) => log((ok ? '✅ ' : '✗ ') + name + (extra ? ' — ' + extra : ''));

  try {
    const { port, stats } = await mock.start(8793);
    const BASE = 'http://127.0.0.1:' + port;

    // نافذة التطبيق
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
    await js(`(function(){try{go('ei')}catch(e){};return true})()`);
    await sleep(1500);

    const api = () => js('(window.proquote&&window.proquote.einvoice)?true:false');

    // ===== 1) حفظ ملف مصر + التحقق أن السر مشفّر فعلاً على القرص =====
    let t = await api();
    R('جسر الفاتورة الإلكترونية متاح (einvoice:*)', t === true);

    const savedEg = await js(`(function(){return window.proquote.einvoice.save({authorityId:'eg-eta',env:'pre',label:'مصر — الفرع الرئيسي',activityCode:'4620',taxNumber:'100-200-300',creds:{clientId:'CID-TEST-EG-777',clientSecret:'PLAIN-SECRET-EG-XYZ-999'}}).then(function(r){return JSON.stringify(r)})})()`);
    R('حفظ ملف منظومة مصر (ETA)', !!savedEg);

    const companiesDir = path.join(app.getPath('userData'), 'companies');
    let rawBytes = Buffer.alloc(0);
    try {
      const files = fs.readdirSync(companiesDir).filter(f => f.endsWith('.db'));
      for (const f of files) rawBytes = Buffer.concat([rawBytes, fs.readFileSync(path.join(companiesDir, f))]);
    } catch (e) {}
    const secretLeaked = rawBytes.length > 0 && rawBytes.toString('latin1').includes('PLAIN-SECRET-EG-XYZ-999');
    R('السر مشفّر فعلاً في قاعدة البيانات (لا نص صريح على القرص)', rawBytes.length > 0 && !secretLeaked, rawBytes.length + ' bytes فُحصت');
    const idEncrypted = !rawBytes.toString('latin1').includes('CID-TEST-EG-777');
    const idView = JSON.parse(await js('(function(){return window.proquote.einvoice.list().then(function(l){return JSON.stringify(l[0].credsView)})})()') || '{}');
    R('Client ID مشفّر على القرص أيضاً + يُسترجاع للعرض عبر الواجهة', idEncrypted && idView.clientId === 'CID-TEST-EG-777');

    // ===== 2) ملف منظومة عامة (قالب أي دولة) يشير للسيرفر الوهمي — اتصال ناجح =====
    const savedG = await js(`(function(){return window.proquote.einvoice.save({authorityId:'generic',env:'pre',label:'منظومة اختبار عامة',customUrls:{pre:{authUrl:'${BASE}/connect/token',apiUrl:'${BASE}/documentsubmissions'},prod:{authUrl:'',apiUrl:''}},creds:{clientId:'GEN-CID-1',clientSecret:'${mock.GOOD_SECRET}'}}).then(function(r){return JSON.stringify(r)})})()`);
    R('حفظ ملف منظومة عامة (روابط مخصصة لأي دولة)', !!savedG);

    const profs1 = JSON.parse(await js('(function(){return window.proquote.einvoice.list().then(function(l){return JSON.stringify(l)})})()') || '[]');
    R('ملفات متعددة معاً (مصر + عامة) والأول افتراضي تلقائياً', profs1.length === 2 && profs1.some(p => p.isDefault));

    // جعل الملف العام الافتراضي (كي يكون الفحص التلقائي على السيرفر الوهمي)
    const genId = profs1.find(p => p.authorityId === 'generic').id;
    await js(`(function(){return window.proquote.einvoice.setDefault('${genId}')})()`);

    // إخفاء السر عن الواجهة
    const masked = profs1.every(p => !(JSON.stringify(p).includes(mock.GOOD_SECRET)) && !(JSON.stringify(p).includes('PLAIN-SECRET')));
    R('الواجهة لا ترى السر إطلاقاً (يُعرض ★ محفوظ مشفّراً)', masked && profs1.every(p => p.credsView && typeof p.credsView.clientSecretSet === 'boolean'));

    const conn1 = JSON.parse(await js(`(function(){return window.proquote.einvoice.test('${genId}').then(function(r){return JSON.stringify(r)})})()`) || '{}');
    R('اختبار اتصال ناجح: متصل + زمن استجابة', conn1.status === 'connected' && conn1.latencyMs >= 0, conn1.latencyMs + 'ms');

    // مؤشر الحالة في الواجهة أخضر
    await js('(function(){try{_eiTest(null,true)}catch(e){};return true})()');
    const pill = await waitJs(`(function(){var s=document.querySelector('#eiStatus .stb');return s?((s.className.indexOf('st-green')>=0&&s.textContent.indexOf('متصل')>=0)?true:null):'NO_PILL'})()`, 8000);
    R('مؤشر الاتصال الحي بالواجهة: أخضر «متصل بالمنظومة»', pill === true);

    // مؤشر الموقّع: غير مطلوب (بلا أداة)
    const sign1 = await js('(function(){return document.querySelector("#eiSign .stb")?document.querySelector("#eiSign .stb").textContent:"NO"})()');
    R('مؤشر الموقّع: «غير مطلوب» بلا أداة توقيع', (sign1 || '').indexOf('غير مطلوب') >= 0, sign1);

    // ===== 3) سر خاطئ → غير متصل برسالة واضحة =====
    const savedBad = await js(`(function(){return window.proquote.einvoice.save({authorityId:'generic',env:'pre',label:'منظومة بسر خاطئ',customUrls:{pre:{authUrl:'${BASE}/connect/token',apiUrl:'${BASE}/documentsubmissions'},prod:{authUrl:'',apiUrl:''}},creds:{clientId:'GEN-CID-BAD',clientSecret:'${mock.BAD_SECRET}'}}).then(function(r){return JSON.stringify(r)})})()`);
    const badId = JSON.parse(savedBad || '{}').id;
    const conn2 = JSON.parse(await js(`(function(){return window.proquote.einvoice.test('${badId}').then(function(r){return JSON.stringify(r)})})()`) || '{}');
    R('سر خاطئ → «غير متصل» مع سبب: بيانات الدخول غير صحيحة', conn2.status === 'disconnected' && (conn2.message || '').indexOf('غير صحيحة') >= 0, conn2.message);

    // ===== 4) إرسال فاتورة → مقبولة =====
    await js(`(function(){
      var invs=[{id:'x1',number:'EI-9001',date:new Date().toISOString().slice(0,10),docType:'I',
        receiver:{type:'B',name:'شركة النور للتجارة',regN:'500-600-700',address:'EG / Cairo / Cairo'},
        lines:[{description:'استشارات فنية',code:'EGS-111',qty:2,price:1000,taxType:'T1',taxSub:'V009',taxRate:14,taxAmount:280,total:2280}],
        totalSales:2000,taxTotals:{T1:280},totalAmount:2280,notes:'',status:'draft',submissionId:null,statusMessage:null,at:Date.now()},
        {id:'x2',number:'EI-9002',date:new Date().toISOString().slice(0,10),docType:'I',
        receiver:{type:'B',name:'REFUSE-ME-عميل مرفوض',regN:'900-900-900',address:'EG'},
        lines:[{description:'بند مرفوض',code:'EGS-222',qty:1,price:500,taxType:'T1',taxSub:'V009',taxRate:14,taxAmount:70,total:570}],
        totalSales:500,taxTotals:{T1:70},totalAmount:570,notes:'',status:'draft',submissionId:null,statusMessage:null,at:Date.now()}];
      localStorage.setItem('pq5_ei',JSON.stringify(invs));rEiL();return true})()`);
    await js('(function(){try{sendEi("x1")}catch(e){};return true})()');
    const acc = await waitJs(`(function(){var l=JSON.parse(localStorage.getItem('pq5_ei')||'[]');var x=l.find(function(z){return z.id==='x1'});return (x&&x.status==='accepted'&&x.submissionId)?JSON.stringify({s:x.submissionId}):null})()`, 12000);
    R('إرسال فاتورة عبر الملف الافتراضي → مقبولة برقم تقديم', !!acc, acc || '');

    // ===== 5) فاتورة ترفضها المنظومة → مرفوضة ورسالة ظاهرة =====
    await js('(function(){try{sendEi("x2")}catch(e){};return true})()');
    const rej = await waitJs(`(function(){var l=JSON.parse(localStorage.getItem('pq5_ei')||'[]');var x=l.find(function(z){return z.id==='x2'});return (x&&x.status==='rejected'&&(x.statusMessage||'').indexOf('رفض')>=0)?x.statusMessage.slice(0,60):null})()`, 12000);
    R('رفض المنظومة → حالة مرفوضة + رسالة السبب بالسجل والقائمة', !!rej, rej || '');

    // ===== 6) حالة الموقّع: مسار موجود = جاهز =====
    const signerPath = path.join(os.tmpdir(), 'pq-mock-signer-test.exe');
    fs.writeFileSync(signerPath, 'MOCK');
    await js(`(function(){return window.proquote.einvoice.save({id:'${genId}',authorityId:'generic',env:'pre',label:'منظومة اختبار عامة',customUrls:{pre:{authUrl:'${BASE}/connect/token',apiUrl:'${BASE}/documentsubmissions'},prod:{authUrl:'',apiUrl:''}},creds:{clientId:'GEN-CID-1',clientSecret:'••••••••'},signerPath:'${signerPath.replace(/\\/g,'\\\\')}'}).then(function(r){return JSON.stringify(r)})})()`);
    const sign2 = JSON.parse(await js('(function(){return window.proquote.einvoice.signerStatus().then(function(r){return JSON.stringify(r)})})()') || '{}');
    R('مؤشر الموقّع: جاهز عند وجود أداة التوقيع', sign2.exists === true && sign2.configured === true);

    // ===== 7) سجل العمليات معبأ =====
    const logs = JSON.parse(await js('(function(){return window.proquote.einvoice.logs().then(function(l){return JSON.stringify(l)})})()') || '[]');
    const hasAll = ['فحص اتصال', 'إرسال فاتورة', 'حفظ ملف'].every(a => logs.some(l => l.action === a));
    R('سجل العمليات: فحص + إرسال + حفظ كلها مسجلة', logs.length >= 4 && hasAll, logs.length + ' عمليات');

    await js('(function(){try{openEiLogs()}catch(e){};return true})()');
    await sleep(600);
    const logRows = await js('(function(){return document.querySelectorAll("#eiLogsTb tr").length})()');
    R('نافذة «سجل العمليات» تعرض الصفوف', logRows >= 4, logRows + ' صف');

    // ===== 8) نافذة إدارة المنظومات تعرض الملفات =====
    await js('(function(){try{openEiCfg()}catch(e){};return true})()');
    await sleep(600);
    const cards = await js('(function(){return document.querySelectorAll("#eiProfList > div").length-1})()');
    R('نافذة «ربط الضرائب» تعرض بطاقات الملفات الثلاثة', cards === 3, cards + ' بطاقات');

    // ===== إحصاءات السيرفر الوهمي (تطابق السلوك) =====
    const st = stats();
    R('السيرفر الوهمي: توكن ناجح+فاشل · تقديم مقبول+مرفوض (التوكِن يُعاد استخدامه من الذاكرة كما صُمم)', st.token200 >= 1 && st.token401 >= 1 && st.submitAccepted === 1 && st.submitRejected === 1, JSON.stringify(st));

    const pass = out.filter((l) => l.startsWith('✅')).length;
    const fail = out.filter((l) => l.startsWith('✗')).length;
    log('===== PROBE EINVOICE: ' + pass + ' PASS / ' + fail + ' FAIL =====');
    await sleep(500);
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
