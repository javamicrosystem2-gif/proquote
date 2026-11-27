// ============================================================
// ProQuote — فحص قسم المستندات (--probe-dc)
// رفع متعدد + دمج تحميل الكل في PDF واحد (pdf-lib) + معاينة
// ============================================================
'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const REPORT = path.join(os.tmpdir(), 'pq-probe-dc-report.txt');

function isolate() {
  const dir = path.join(os.tmpdir(), 'pq-probe-dc-data');
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
    const js = (code) => wc.executeJavaScript(code, true);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    await wc.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
    await sleep(4500);
    await js(`(function(){try{document.getElementById('loginScreen').style.display='none'}catch(e){} return true})()`);

    // PNG 1x1 حقيقي + PDF حقيقي (مولّد بـ pdf-lib في الخلفية)
    const PNG1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const { PDFDocument } = require('pdf-lib');
    const pd = await PDFDocument.create();
    pd.addPage([300, 300]);
    const PDFB64 = Buffer.from(await pd.save()).toString('base64');
    const pngB64 = Buffer.from(PNG1x1, 'base64').toString('base64');

    // 1) مجلد + رفع متعدد داخل المجلد
    let t = await js(`(function(){
      localStorage.setItem('pq5_dc', JSON.stringify([{id:'fld1',name:'1',folder:true,parentId:null,files:[],at:1}]));
      go('documents');
      var pngB64='${PNG1x1}';
      var bytes=Uint8Array.from(atob(pngB64),function(c){return c.charCodeAt(0)});
      window._tF1=new File([bytes],'a.png',{type:'image/png'});
      window._tF2=new File([bytes],'b.png',{type:'image/png'});
      dcUploadDlg('fld1');
      return document.getElementById('mDcUpload').classList.contains('show')})()`);
    R('مودال «رفع مستند» يفتح', t === true);
    await sleep(300);

    t = await js(`(function(){
      dcFilePicked({target:{files:[window._tF1,window._tF2]}});
      var okList=_dcPendFiles.length===2&&document.getElementById('dcPickList').textContent.indexOf('a.png')>=0&&document.getElementById('dcPickList').textContent.indexOf('b.png')>=0;
      var inpAlive=!!document.getElementById('dcFile');
      return JSON.stringify({okList:okList,inpAlive:inpAlive})})()`);
    const r1 = JSON.parse(t || '{}');
    R('اختيار ملفين معاً يظهرا بالقائمة وحقل الإدخال سليم بعد الاختيار (الإصلاح)', r1.okList === true && r1.inpAlive === true, t);

    t = await js(`(function(){cfDcUpload();return true})()`);
    await sleep(1200);
    t = await js(`(function(){var folder=JSON.parse(localStorage.getItem('pq5_dc'))[0];return JSON.stringify({n:(folder.files||[]).length,titles:(folder.files||[]).map(function(x){return x.title})})})()`);
    const r2 = JSON.parse(t || '{}');
    R('حفظ المستندين داخل المجلد «1»', r2.n === 2 && r2.titles.indexOf('a.png') >= 0, t);

    // 2) تحميل الكل = دمج في PDF واحد (2 صورة + PDF حقيقي)
    t = await js(`(function(){
      var folder=JSON.parse(localStorage.getItem('pq5_dc'))[0];
      folder.files.push({id:'f3',title:'c',name:'c.pdf',type:'application/pdf',data:'data:application/pdf;base64,${PDFB64}'});
      localStorage.setItem('pq5_dc',JSON.stringify([folder]));
      return window.proquote.documents.mergeAll({files:folder.files,name:folder.name}).then(function(r){return JSON.stringify(r)})})()`);
    const r3 = JSON.parse(t || '{}');
    R('«تحميل الكل»: دمج 3 مستندات (2 صورة + PDF) في PDF واحد', r3.ok === true && r3.pages >= 3, t.slice(0, 120));
    t = await js(`(function(){var r=window.__lastMerge||(window.__lastMerge={});return 'done'})()`);
    // تحقق صلاحية PDF من البيانات الخام عبر فحص السلسلة
    const b64len = (r3.b64 || '').length;
    const head = Buffer.from((r3.b64 || '').slice(0, 20), 'base64').toString('latin1');
    R('الناتج ملف PDF صالح (%PDF)', head.indexOf('%PDF') === 0 && b64len > 1000, 'len=' + b64len);

    // 3) المستحقات: إخفاء الرسالة عند وجود أرصدة أوامر التوريد
    t = await js(`(async function(){
      localStorage.setItem('pq5_rec','[]');
      localStorage.setItem('pq5_so', JSON.stringify([{id:'soE',number:'SO-E1',clientName:'عميل',totalAmount:5000,paidAmount:2000,paymentStatus:'partial_paid',status:'working',payments:[{date:'2026-01-01',amount:2000,method:'cash',received:true}],at:1}]));
      go('receivables');
      await new Promise(r13=>setTimeout(r13,400));
      var v=document.getElementById('recView');
      return JSON.stringify({hidden:v.style.display==='none'})})()`);
    const r4 = JSON.parse(t || '{}');
    R('الرسالة «لا توجد مستحقات» تختفي عند وجود أرصدة أوامر التوريد', r4.hidden === true, t);

    // 4) المنزلقات تحدث المعاينة فوراً
    t = await js(`(async function(){
      localStorage.setItem('pq5_wb', JSON.stringify([{id:'wbS',number:'WB-S',date:'2026-01-01',clientName:'عميل',items:[{name:'صنف',qty:2}],showSize:true,showColor:true,extraCols:[],at:1}]));
      _pvCurDoc={kind:'waybill',id:'wbS'};
      wbpOpenPrint();
      await new Promise(r5=>setTimeout(r5,400));
      document.getElementById('wbpLayout').value='exact';
      wbpLayoutChange();
      await new Promise(r6=>setTimeout(r6,200));
      document.getElementById('wbpHdr').value='60';
      document.getElementById('wbpHdr').dispatchEvent(new Event('input'));
      await new Promise(r7=>setTimeout(r7,250));
      var s60=document.getElementById('wbpPrev').innerHTML;
      document.getElementById('wbpHdr').value='120';
      document.getElementById('wbpHdr').dispatchEvent(new Event('input'));
      await new Promise(r8=>setTimeout(r8,250));
      var s120=document.getElementById('wbpPrev').innerHTML;
      var okHdr=s60!==s120;
      document.getElementById('wbpTbl').value='50';
      document.getElementById('wbpTbl').dispatchEvent(new Event('input'));
      await new Promise(r9=>setTimeout(r9,250));
      var s50=document.getElementById('wbpPrev').innerHTML;
      document.getElementById('wbpTbl').value='120';
      document.getElementById('wbpTbl').dispatchEvent(new Event('input'));
      await new Promise(r10=>setTimeout(r10,250));
      var s120t=document.getElementById('wbpPrev').innerHTML;
      var okTbl=s50!==s120t;
      document.getElementById('wbpFs').value='60';
      document.getElementById('wbpFs').dispatchEvent(new Event('input'));
      await new Promise(r11=>setTimeout(r11,250));
      var sf60=document.getElementById('wbpPrev').innerHTML;
      document.getElementById('wbpFs').value='110';
      document.getElementById('wbpFs').dispatchEvent(new Event('input'));
      await new Promise(r12=>setTimeout(r12,250));
      var sf110=document.getElementById('wbpPrev').innerHTML;
      var okFs=sf60!==sf110;
      cm('mWbPrint');
      return JSON.stringify({okHdr:okHdr,okTbl:okTbl,okFs:okFs})})()`);
    const r5 = JSON.parse(t || '{}');
    R('المنزلقات الثلاثة تحدث «معاينة طبق الأصل» فور التعديل', r5.okHdr === true && r5.okTbl === true && r5.okFs === true, t);

    const pass = out.filter((l) => l.startsWith('✅')).length;
    const fail = out.filter((l) => l.startsWith('✗')).length;
    log('===== PROBE DC: ' + pass + ' PASS / ' + fail + ' FAIL =====');
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
