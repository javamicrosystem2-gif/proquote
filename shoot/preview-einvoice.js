// ============================================================
// ProQuote — معاينة حية للفاتورة الإلكترونية (--ei-preview)
// منظومة وهمية آمنة على 127.0.0.1 + التقاط صور + النافذة
// تبقى مفتوحة لتجربتك بنفسك (إرسال الفاتورة EI-8001 مثلاً)
// ============================================================
'use strict';

const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const mock = require('./mock-einvoice-server');

function isolate() {
  // يُستدعى من main.js قبل الجاهزية (نفس نمط probe)
}

async function preview() {
  const { port } = await mock.start(8794);
  const BASE = 'http://127.0.0.1:' + port;
  const OUT = path.join(__dirname, 'preview-einvoice');
  try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}

  const win = new BrowserWindow({
    width: 1380, height: 850, show: true,
    webPreferences: { preload: path.join(__dirname, '..', 'src', 'main', 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false }
  });
  const wc = win.webContents;
  const js = (code) => wc.executeJavaScript(code, true);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const cap = async (n) => {
    try { const im = await wc.capturePage(); fs.writeFileSync(path.join(OUT, n), im.toPNG()); console.log('[ei-preview] captured', n); }
    catch (e) { console.log('[ei-preview] fail', n, e.message); }
  };

  await wc.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
  await sleep(4000);
  await js(`(function(){try{document.getElementById('loginScreen').style.display='none'}catch(e){};go('ei');return true})()`);
  await sleep(1200);

  // ملفان: مصر (عرض) + منظومة عامة متصلة بالسيرفر الوهمي (افتراضي)
  await js(`(function(){return window.proquote.einvoice.save({authorityId:'eg-eta',env:'pre',label:'مصر — الفرع الرئيسي',activityCode:'4620',taxNumber:'100-200-300',creds:{clientId:'CID-EG-DEMO',clientSecret:'${mock.GOOD_SECRET}'}}).then(function(){return true})})()`);
  await js(`(function(){return window.proquote.einvoice.save({authorityId:'generic',env:'pre',label:'منظومة اختبار عامة — متصلة',customUrls:{pre:{authUrl:'${BASE}/connect/token',apiUrl:'${BASE}/documentsubmissions'},prod:{authUrl:'',apiUrl:''}},creds:{clientId:'GEN-DEMO',clientSecret:'${mock.GOOD_SECRET}'}}).then(function(r){window._gid=r.id;return true})})()`);
  await js('(function(){return window.proquote.einvoice.setDefault(window._gid).then(function(){return true})})()');

  // فاتورة تجريبية جاهزة للإرسال
  await js(`(function(){
    var invs=[{id:'p1',number:'EI-8001',date:new Date().toISOString().slice(0,10),docType:'I',
    receiver:{type:'B',name:'شركة النور للتجارة',regN:'500-600-700',address:'EG / Cairo / Cairo'},
    lines:[{description:'استشارات فنية',code:'EGS-111',qty:2,price:1000,taxType:'T1',taxSub:'V009',taxRate:14,taxAmount:280,total:2280}],
    totalSales:2000,taxTotals:{T1:280},totalAmount:2280,notes:'',status:'draft',submissionId:null,statusMessage:null,at:Date.now()}];
    localStorage.setItem('pq5_ei',JSON.stringify(invs));return true})()`);
  await js(`(function(){go('ei');return true})()`);
  await sleep(1500);
  await cap('1-section-status.png');
  await sleep(2200);
  await cap('2-connected-green.png');
  await js(`(function(){openEiCfg();return true})()`);
  await sleep(900);
  await js(`(function(){eiNewProfile();return true})()`);
  await sleep(500);
  await cap('3-profiles-manager.png');
  await js(`(function(){cm('mEiCfg');openEiLogs();return true})()`);
  await sleep(800);
  await cap('4-operations-log.png');
  await js(`(function(){cm('mEiLogs');go('ei');return true})()`);
  console.log('[ei-preview] النافذة مفتوحة للتجربة الحية — جرّب زر الإرسال لفاتورة EI-8001 وشاهد الحالة والسجل');
}

module.exports = { isolate, preview };
