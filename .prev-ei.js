const { app, BrowserWindow } = require('electron');
const path=require('path'),fs=require('fs'),os=require('os');
const mock=require('./shoot/mock-einvoice-server');
const OUT=path.join(process.cwd(),'shoot','preview-einvoice');
app.whenReady().then(async()=>{
  const dir=path.join(os.tmpdir(),'pq-preview-ei');fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
  app.setPath('userData',dir);
  const {port}=await mock.start(8794);
  const BASE='http://127.0.0.1:'+port;
  const win=new BrowserWindow({width:1380,height:850,show:true,webPreferences:{preload:path.join(__dirname,'src','main','preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:false,spellcheck:false}});
  const wc=win.webContents;const js=(c)=>wc.executeJavaScript(c,true);
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  const cap=async(n)=>{const im=await wc.capturePage();fs.writeFileSync(path.join(OUT,n),im.toPNG());console.log('captured',n)};
  await wc.loadFile(path.join(__dirname,'src','renderer','index.html'));
  await sleep(4000);
  await js(`(function(){document.getElementById('loginScreen').style.display='none';go('ei');return true})()`);
  await sleep(1200);
  // ملف مصر (عرض البطاقة) + ملف عام متصل بالسيرفر الوهمي
  await js(`(function(){return window.proquote.einvoice.save({authorityId:'eg-eta',env:'pre',label:'مصر — الفرع الرئيسي',activityCode:'4620',taxNumber:'100-200-300',creds:{clientId:'CID-EG-DEMO',clientSecret:'${mock.GOOD_SECRET}'}})})()`);
  await js(`(function(){return window.proquote.einvoice.save({authorityId:'generic',env:'pre',label:'منظومة اختبار عامة — متصلة',customUrls:{pre:{authUrl:'${BASE}/connect/token',apiUrl:'${BASE}/documentsubmissions'},prod:{authUrl:'',apiUrl:''}},creds:{clientId:'GEN-DEMO',clientSecret:'${mock.GOOD_SECRET}'}}).then(function(r){window._gid=r.id;return true})})()`);
  await js(`(function(){return window.proquote.einvoice.setDefault(window._gid)})()`);
  // فاتورة تجريبية مقبولة للقائمة
  await js(`(function(){
    var invs=[{id:'p1',number:'EI-8001',date:new Date().toISOString().slice(0,10),docType:'I',
    receiver:{type:'B',name:'شركة النور للتجارة',regN:'500-600-700',address:'EG / Cairo / Cairo'},
    lines:[{description:'استشارات فنية',code:'EGS-111',qty:2,price:1000,taxType:'T1',taxSub:'V009',taxRate:14,taxAmount:280,total:2280}],
    totalSales:2000,taxTotals:{T1:280},totalAmount:2280,notes:'',status:'draft',submissionId:null,statusMessage:null,at:Date.now()}];
    localStorage.setItem('pq5_ei',JSON.stringify(invs));return true})()`);
  await js(`(function(){go('ei');return true})()`);
  await sleep(1500);
  await cap('1-section-status.png');   // القسم + شريط الحالة (سيتحول أخضر بعد الفحص التلقائي)
  await sleep(2000);
  await cap('2-connected-green.png');  // المؤشر أخضر
  await js(`(function(){openEiCfg();return true})()`);
  await sleep(900);
  await js(`(function(){eiNewProfile();return true})()`);
  await sleep(500);
  await cap('3-profiles-manager.png'); // إدارة المنظومات + نموذج منظومة جديدة
  await js(`(function(){cm('mEiCfg');openEiLogs();return true})()`);
  await sleep(800);
  await cap('4-operations-log.png');   // سجل العمليات
  console.log('PREVIEW_DONE النافذة مفتوحة للتجربة');
});
