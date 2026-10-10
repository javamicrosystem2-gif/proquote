// ============================================================
// ProQuote — اختبار الواجهة التشغيلي (--uitest)
// يعمل على مجلد معزول في TEMP وينفّذ سيناريوهات فعلية عبر
// دوال الواجهة نفسها، ثم يكتب النتيجة في userData/uitest.txt
// ============================================================
'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

function isolate() {
  const dir = path.join(os.tmpdir(), 'pq-uitest-data');
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  fs.mkdirSync(dir, { recursive: true });
  app.setPath('userData', dir);
}

async function run() {
  const out = [];
  const log = (s) => out.push(s);
  const win = new BrowserWindow({
    width: 1380, height: 850, show: true,
    webPreferences: { preload: path.join(__dirname, '..', 'src', 'main', 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false }
  });
  const wc = win.webContents;
  const js = (code) => wc.executeJavaScript(code, true);

  const load = () => wc.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // زرع منتج + صنف مخزن + إعداد
  await load();
  await sleep(4000);
  await js(`(function(){
    localStorage.setItem('pq5_p', JSON.stringify([{id:'p1',code:'P-1001',name:'رول بلاستيك اختبار',price:100,unit:'رول',at:1}]));
    localStorage.setItem('pq5_wi', JSON.stringify([{id:'w1',code:'P-1001',name:'رول بلاستيك اختبار',unit:'رول',minQty:0,at:1}]));
    localStorage.setItem('pq5_wh', JSON.stringify([{id:'wh1',name:'المخزن الرئيسي',at:1}]));
    localStorage.setItem('pq5_wm', '[]');
    return true})()`);
  await load();
  await sleep(4000);
  await js(`(function(){try{document.getElementById('loginScreen').style.display='none'}catch(e){} return true})()`);

  const R = (name, ok, extra) => log((ok ? '✅ ' : '✗ ') + name + (extra ? ' — ' + extra : ''));

  // 1) فتح مودال الحركة المتعددة
  let t = await js(`(function(){try{openMvDoc('in');return document.getElementById('mMv').classList.contains('show') && document.querySelectorAll('#mvib tr').length>=2}catch(e){return 'ERR:'+e.message}})()`);
  R('فتح مودال الحركة المتعددة (صفوف ابتدائية)', t === true, typeof t === 'string' ? t : '');

  // 2) إضافة عمود مخصص
  t = await js(`(function(){try{document.getElementById('mvColName').value='رقم الشحنة';document.getElementById('mvColNum').checked=true;cfAddMvCol();return (ls().mvExtraCols||[]).length===1 && document.querySelector('#mvTh th:nth-child(4)').textContent==='رقم الشحنة'}catch(e){return 'ERR:'+e.message}})()`);
  R('إضافة عمود «رقم الشحنة» وحفظه في الإعدادات + ظهوره في الجدول', t === true, typeof t === 'string' ? t : '');

  // 3) منتقي المنتجات يضيف صفاً مربوطاً
  t = await js(`(function(){try{addProdToMv('p1');const rows=document.querySelectorAll('#mvib tr');const last=rows[rows.length-1];return last.querySelector('.mv-name').value.includes('رول بلاستيك اختبار') && last.getAttribute('data-wid')==='w1'}catch(e){return 'ERR:'+e.message}})()`);
  R('منتقي المنتجات: صف بالكود والربط التلقائي بصنف المخزن', t === true, typeof t === 'string' ? t : '');

  // 4) قيم الأعمدة + الكمية ثم الحفظ (مع تشخيص ما قبل الحفظ)
  const dbg = await js(`(function(){try{const rows=document.querySelectorAll('#mvib tr');const last=rows[rows.length-1];last.querySelector('.mv-qty').value='7';const col=last.querySelector('input[data-col]');if(col)col.value='77';return JSON.stringify({rows:rows.length,colsInRow:last.querySelectorAll('input[data-col]').length,colKey:col?col.getAttribute('data-col'):null,colVal:col?col.value:null,settingsCols:(ls().mvExtraCols||[]).map(function(x){return x.key}),globalCols:(typeof mvExtraCols!=='undefined'&&mvExtraCols)?mvExtraCols.map(function(x){return x.key}):null})}catch(e){return 'ERR:'+e.message}})()`);
  t = await js(`(function(){try{cfMv();const wm=ld('pq5_wm');const ok=wm.length===1 && wm[0].itemId==='w1' && wm[0].qty===7 && wm[0].extra && Object.keys(wm[0].extra).length===1;return ok?true:'wm='+JSON.stringify(wm)}catch(e){return 'ERR:'+e.message}})()`);
  R('حفظ الحركة: صف واحد مرتبط بالصنف، كمية 7، وقيمة العمود محفوظة', t === true, typeof t === 'string' ? (t + ' | قبل الحفظ: ' + dbg) : '');

  // 5) أثر الحركة على الرصيد
  t = await js(`(function(){try{return whStock('w1')===7}catch(e){return 'ERR:'+e.message}})()`);
  R('الرصيد بعد الحركة = 7', t === true, typeof t === 'string' ? t : '');

  // 6) حركة إخراج متعدد تنقص الرصيد
  t = await js(`(function(){try{openMvDoc('out');const rows=document.querySelectorAll('#mvib tr');if(rows[0])rows[0].remove();if(document.querySelectorAll('#mvib tr').length===0)addMvRow();const r0=document.querySelectorAll('#mvib tr')[0];r0.querySelector('.mv-name').value='رول بلاستيك اختبار';r0.querySelector('.mv-code').value='P-1001';r0.querySelector('.mv-qty').value='3';cfMv();return whStock('w1')===4}catch(e){return 'ERR:'+e.message}})()`);
  R('حركة إخراج: الرصيد أصبح 4', t === true, typeof t === 'string' ? t : '');

  // 7) منتقي المنتجات في مودال المدخلات/المخرجات (io)
  t = await js(`(function(){try{go('warehouse');openIo('in');addProdToIo('p1');const rows=document.querySelectorAll('#ioib tr');const last=rows[rows.length-1];return last && last.querySelector('.io-name').value.includes('رول بلاستيك اختبار')}catch(e){return 'ERR:'+e.message}})()`);
  R('منتقي المنتجات في مودال المدخلات (mIo)', t === true, typeof t === 'string' ? t : '');

  // 8) عمود إعدادات الحركة يبقى بعد إعادة التحميل
  await load();
  await sleep(3500);
  t = await js(`(function(){try{return (ls().mvExtraCols||[]).length===1}catch(e){return 'ERR:'+e.message}})()`);
  R('العمود المخصص يبقى محفوظاً بعد إعادة التشغيل', t === true, typeof t === 'string' ? t : '');

  // ===== البند E: بوليصة الشحن — شيكبوكسات + أعمدة إضافية =====
  await js(`(function(){try{document.getElementById('loginScreen').style.display='none'}catch(e){}return true})()`);
  await js(`(function(){localStorage.setItem('pq5_c', JSON.stringify([{id:'cl1',name:'عميل الفحص',phone:'0100',at:1}]));return true})()`);

  // 9) فتح بوليصة جديدة وإخفاء المقاس بالشيكبوكس
  t = await js(`(function(){try{go('shipping');openWb();const before=document.querySelectorAll('#wbTh th').length;document.getElementById('wbcl').value='cl1';document.getElementById('wbib').innerHTML='';addWbRow({name:'صنف شحن اختبار',size:'100',color:'أحمر',qty:2});const rowBefore=document.querySelectorAll('#wbib tr')[0].querySelector('.wb-name').value;document.getElementById('wbTSize').checked=false;wbTglSize();const after=document.querySelectorAll('#wbTh th').length;const szGone=!document.querySelector('#wbib tr .wb-size');return after===before-1 && szGone && document.querySelectorAll('#wbib tr')[0].querySelector('.wb-name').value===rowBefore}catch(e){return 'ERR:'+e.message}})()`);
  R('بوليصة الشحن: إخفاء «المقاس» بالشيكبوكس يحذف العمود ويحفظ القيم', t === true, typeof t === 'string' ? t : '');

  // 10) إضافة عمود إضافي + قيمة + حفظ البوليصة
  t = await js(`(function(){try{document.getElementById('wbColName').value='رقم الصندوق';document.getElementById('wbColNum').checked=false;cfAddWbCol();const row=document.querySelectorAll('#wbib tr')[0];const colInp=row.querySelector('input[data-col]');if(colInp)colInp.value='BOX-9';const wb=saveWb();const wbs=ld('pq5_wb');const d=wbs[wbs.length-1];return d && d.showSize===false && d.extraCols.length===1 && d.items[0].size==='100' && d.items[0].extra && Object.keys(d.items[0].extra).length===1}catch(e){return 'ERR:'+e.message}})()`);
  R('حفظ البوليصة: showSize=false + العمود الإضافي + القيم داخل الأصناف', t === true, typeof t === 'string' ? t : '');

  // 11) إعادة فتح البوليصة تعيد الأعمدة كما حُفظت
  t = await js(`(function(){try{const wbs=ld('pq5_wb');const d=wbs[wbs.length-1];edWb(d.id);return document.getElementById('wbTSize').checked===false && wbExtraCols.length===1 && document.querySelectorAll('#wbib tr .wb-color').length===1}catch(e){return 'ERR:'+e.message}})()`);
  R('إعادة الفتح: الشيكبوكس والأعمدة تُستعاد من المستند', t === true, typeof t === 'string' ? t : '');

  // 12) معاينة الطباعة تتبع الأعمدة المخفية/الإضافية
  t = await js(`(function(){try{const wbs=ld('pq5_wb');const d=wbs[wbs.length-1];vWb(d.id);const html=document.getElementById('pvC').innerHTML;return html.includes('رقم الصندوق') && html.includes('BOX-9') && !html.includes('>المقاس<')}catch(e){return 'ERR:'+e.message}})()`);
  R('معاينة الطباعة: العمود الإضافي يظهر والمقاس مخفي', t === true, typeof t === 'string' ? t : '');

  // ===== البند F: أصناف الشحنة الجديدة + ربط بأمر توريد =====
  await js(`(function(){localStorage.setItem('pq5_so', JSON.stringify([{id:'so1',number:'PO-9001',clientName:'عميل الفحص',clientId:'cl1',date:'2026-01-01',totalAmount:100,status:'working',paymentStatus:'partial_paid',paidAmount:0,items:[{name:'صنف توريد اختبار',productCode:'P-1001',qty:10,unit:'رول'}],at:1}]));return true})()`);

  // 13) شحنة جديدة: منتقي منتج + إخفاء اللون + حفظ
  t = await js(`(function(){try{openShp();document.getElementById('shpnm').value='عميل الفحص';addProdToShp('p1');const qt=document.querySelectorAll('#shpib tr .shp-qty');qt[qt.length-1].value='4';document.getElementById('shpTColor').checked=false;shpTglColor();saveShp();const s=ld('pq5_shp');const d=s[s.length-1];const ok=d && d.items.length===1 && d.items[0].code==='P-1001' && d.showColor===false && d.contents.indexOf('رول بلاستيك اختبار')>=0;return ok?true:'d='+JSON.stringify({items:d?d.items:null,showColor:d?d.showColor:null,contents:d?d.contents:null})}catch(e){return 'ERR:'+e.message}})()`);
  R('شحنة جديدة: منتقي منتج + إخفاء اللون + حفظ + توليد وصف تلقائي', t === true, typeof t === 'string' ? t : '');

  // 14) تعبئة الأصناف من أمر التوريد
  t = await js(`(function(){try{openShp();document.getElementById('shpnm').value='عميل الفحص';document.getElementById('shpsrct').value='supply';popShpSrc();document.getElementById('shpsrc').value='so1';fillShpFromSo();const rows=document.querySelectorAll('#shpib tr');return rows.length===1 && rows[0].querySelector('.shp-name').value==='صنف توريد اختبار' && rows[0].querySelector('.shp-code').value==='P-1001' && document.getElementById('shpcl').value==='cl1'}catch(e){return 'ERR:'+e.message}})()`);
  R('الربط بأمر توريد: تعبئة الأصناف + الكود + العميل تلقائياً', t === true, typeof t === 'string' ? t : '');

  // 15) عمود إضافي في الشحنة + إعادة فتح
  t = await js(`(function(){try{document.getElementById('shpColName').value='عدد الكراتين';document.getElementById('shpColNum').checked=true;cfAddShpCol();const row=document.querySelectorAll('#shpib tr')[0];const ci=row.querySelector('input[data-col]');if(ci)ci.value='12';row.querySelector('.shp-qty').value='10';saveShp();const s=ld('pq5_shp');const d=s[s.length-1];edShp(d.id);return shpExtraCols.length===1 && document.querySelectorAll('#shpib tr input[data-col]').length===1 && document.getElementById('shpTColor').checked===false}catch(e){return 'ERR:'+e.message}})()`);
  R('عمود «عدد الكراتين» + إعادة فتح الشحنة باستعادة الإعدادات', t === true, typeof t === 'string' ? t : '');

  // 16) قائمة الشحنات تعرض ملخص الأصناف
  t = await js(`(function(){try{go('shipping');const rows=Array.from(document.querySelectorAll('#shpTb tr'));const hit=rows.some(function(r){return r.textContent.includes('صنف توريد اختبار')});if(hit)return true;const s=ld('pq5_shp');return 'DBG docs='+JSON.stringify(s.map(function(d){return {n:d.number,items:(d.items||[]).map(function(i){return i.name+'#'+i.qty}),c:d.contents}}))}catch(e){return 'ERR:'+e.message}})()`);
  R('قائمة الشحنات تعرض ملخص الأصناف بدل الوصف الفارغ', t === true, typeof t === 'string' ? t : '');

  const passed = out.filter((l) => l.startsWith('✅')).length;
  log('=== ' + passed + '/' + (out.length) + ' ===');
  const report = path.join(app.getPath('userData'), '..', 'pq-uitest-report.txt');
  try { fs.writeFileSync('C:/Users/java/AppData/Local/Temp/pq-uitest-report.txt', out.join('\n'), 'utf8'); } catch (_) {}
  console.log(out.join('\n'));
  app.exit(0);
}

module.exports = { isolate, run };
