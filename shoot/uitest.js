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

  // ===== التحديث 2: روابط الاشتراك وأدوات التواصل =====
  // 17) مودال الترخيص: زر PayPal صحيح الاقتباس + أزرار تيليجرام/بريد + شريط تواصل
  t = await js(`(function(){try{go('dash');openLicenseModal();const html=document.getElementById('subPlans').innerHTML;const quoted=html.includes("subPay('full')")||html.includes('subPay(\\'full\\')');const tg=html.includes('subTelegram');const em=html.includes('subEmail');const strip=html.includes('t.me/javamicro')&&html.includes('facebook.com/proquoteamrnada');const linkOk=!!((_plans().payLinks||{}).full_m);return {quoted:quoted,tg:tg,em:em,strip:strip,linkOk:linkOk,all:quoted&&tg&&em&&strip&&linkOk}}catch(e){return 'ERR:'+e.message}})()`);
  R('مودال الترخيص: PayPal مقتبس + تيليجرام/بريد + شريط التواصل + الروابط موجودة', t && t.all === true, typeof t === 'string' ? t : JSON.stringify(t));

  // 18) رسالة الاشتراك تحمل الخطة ومعرف الجهاز
  t = await js(`(function(){try{_subCycle='m';return _subMsg('mgmt').then(function(m){return m.includes('Management')&&m.includes('معرف جهازي')})}catch(e){return 'ERR:'+e.message}})()`);
  R('رسالة الاشتراك تُبنى بالباقة ومعرف الجهاز', t === true, typeof t === 'string' ? t : '');

  // 19) أدوات التواصل في الشريط الجانبي
  t = await js(`(function(){try{const sb=document.querySelector('.sidebar').innerHTML;return sb.includes('https://t.me/javamicro')&&sb.includes('https://www.facebook.com/proquoteamrnada')&&sb.includes('mailto:amrnada@mail.ru')}catch(e){return 'ERR:'+e.message}})()`);
  R('الشريط الجانبي: أزرار تيليجرام وفيسبوك والبريد', t === true, typeof t === 'string' ? t : '');

  // ===== البند 2: أكواد المنتجات التلقائية =====
  // 20) منتج جديد: الكود معبأ مسبقاً بفريد + حفظ بكود فارغ يولّد تلقائياً
  t = await js(`(function(){try{localStorage.setItem('pq5_p', JSON.stringify([{id:'p1',code:'P-1001',name:'قديم 1',price:1,unit:'قطعة',at:1},{id:'p2',code:'',name:'قديم بلا كود',price:1,unit:'قطعة',at:2}]));go('products');openPM();const pre=document.getElementById('pcd').value;
document.getElementById('pn').value='منتج جديد تجريبي';document.getElementById('pcd').value='';saveP();
const ps=ld('pq5_p');const saved=ps.find(function(x){return x.name==='منتج جديد تجريبي'});
return {pre:pre,savedCode:saved?saved.code:null,ok:!!pre&&!!saved&&!!(saved&&saved.code)}}catch(e){return 'ERR:'+e.message}})()`);
  R('منتج جديد: كود مقترح مسبقاً + الحفظ بلا كود يولّد فريداً', t && t.ok === true && !!t.savedCode, typeof t === 'string' ? t : JSON.stringify(t));

  // 21) رفض الكود المكرر
  t = await js(`(function(){try{openPM();document.getElementById('pn').value='مكرر تجريبي';document.getElementById('pcd').value='P-1001';saveP();return !ld('pq5_p').some(function(x){return x.name==='مكرر تجريبي'})}catch(e){return 'ERR:'+e.message}})()`);
  R('رفض حفظ منتج بكود مستخدم لمنتج آخر', t === true, typeof t === 'string' ? t : '');

  // 22) توليد الأكواد الناقصة: يملأ الفارغ ولا يغيّر الموجود + كلها فريدة
  t = await js(`(function(){try{genMissingProdCodes();const ps=ld('pq5_p');const noCode=ps.filter(function(p){return !(p.code||'').trim()}).length;const codes=ps.map(function(p){return (p.code||'').trim().toUpperCase()});const uniq=new Set(codes).size===codes.length;const kept=ps.find(function(x){return x.id==='p1'}).code==='P-1001';return noCode===0&&uniq&&kept}catch(e){return 'ERR:'+e.message}})()`);
  R('توليد الناقص: يملأ الفارغ بفريد + يحترم الموجود', t === true, typeof t === 'string' ? t : '');

  // ===== البند 3: إعادة التشغيل عند تعيين الشركة + الاسم بالعنوان =====
  // 23) عنوان القسم يعرض اسم الشركة الافتراضية
  t = await js(`(function(){try{go('company');return new Promise(function(res){setTimeout(function(){res(document.getElementById('compTitleName').textContent.length>0)},400)})}catch(e){return 'ERR:'+e.message}})()`);
  R('عنوان قسم الشركة يعرض اسم الشركة الافتراضية', t === true, typeof t === 'string' ? t : '');

  // 24) التبديل: حفظ كامل ← مسح ← تبديل ← أمر إعادة التشغيل (بمحاكاة الريستارت)
  t = await js(`(async function(){try{
const PQ=window.proquote;
// تنظيف أي بقايا من تشغيلة سابقة (حتى لو كانت قد صارت الافتراضية)
var _pre=await PQ.companies.list();var _old=_pre.find(function(c){return c.name==='__شركة_ريستارت__'});
if(_old){if(_old.isDefault){var _first=_pre.find(function(c){return c.id!==_old.id});if(_first)await PQ.companies.setDefault(_first.id)}await PQ.companies.remove(_old.id)}
var cr=await PQ.companies.create('__شركة_ريستارت__');
if(!cr||!cr.ok)return 'create failed: '+(cr&&cr.error);
var relaunchCalled=false;window.__PQ_RELAUNCH_HOOK=function(){relaunchCalled=true};
window.confirm=function(){return true};
localStorage.setItem('__sw_test__','1');
await setDefComp(cr.id);
await new Promise(function(res){setTimeout(res,900)});
window.__PQ_RELAUNCH_HOOK=null;
var switched=await PQ.companies.current();
var restored=(switched&&switched.name==='__شركة_ريستارت__');
var cleared=localStorage.length===0;
await PQ.companies.setDefault(1);
await PQ.companies.remove(cr.id);
return {restored:restored,cleared:cleared,relaunch:relaunchCalled,ok:restored&&relaunchCalled}}catch(e){return 'ERR:'+e.message}})()`);
  R('التبديل: مسح الذاكرة ← تبديل فعلي ← أمر إعادة التشغيل', t && t.ok === true, typeof t === 'string' ? t : JSON.stringify(t));

  // ===== البند 4: المظهر والألوان =====
  // 25) ثيم فاتح يغيّر ألوان البرنامج فعلياً ويحفظ
  t = await js(`(function(){try{go('settings');stab('theme');thPreset('light');const cs=getComputedStyle(document.documentElement).getPropertyValue('--bg0').trim();const saved=(ls().theme&&ls().theme.key)==='light';const scheme=getComputedStyle(document.documentElement).colorScheme||document.documentElement.style.colorScheme;return {bg0:cs,saved:saved,scheme:String(scheme),ok:cs==='#eef2f8'&&saved}}catch(e){return 'ERR:'+e.message}})()`);
  R('ثيم «فاتح نظيف»: الألوان تتغير فورياً وتُحفظ', t && t.ok === true, typeof t === 'string' ? t : JSON.stringify(t));

  // 26) تحكم يدوي في اللون المميز + اشتقاق التدرجات تلقائياً
  t = await js(`(function(){try{thSetVar('--acc','#123456');const acc=getComputedStyle(document.documentElement).getPropertyValue('--acc').trim();const acc2=getComputedStyle(document.documentElement).getPropertyValue('--acc2').trim();return {acc:acc,acc2:acc2,ok:acc==='#123456'&&acc2.indexOf('18,52,86')>=0}}catch(e){return 'ERR:'+e.message}})()`);
  R('لون مميز مخصص + اشتقاق خلفياته الشفافة تلقائياً', t && t.ok === true, typeof t === 'string' ? t : JSON.stringify(t));

  // 27) الثيم يبقى بعد إعادة التحميل + التكبير يعمل
  await load();
  await sleep(3500);
  t = await js(`(function(){try{const acc=getComputedStyle(document.documentElement).getPropertyValue('--acc').trim();thZoom(1.2);const z=document.body.style.zoom;return {acc:acc,zoom:z,ok:acc==='#123456'&&String(z)==='1.2'}}catch(e){return 'ERR:'+e.message}})()`);
  R('الثيم يبقى بعد إعادة التشغيل + حجم العرض يعمل', t && t.ok === true, typeof t === 'string' ? t : JSON.stringify(t));

  // 28) إعادة الافتراضي
  t = await js(`(function(){try{window.confirm=function(){return true};thReset();const acc=getComputedStyle(document.documentElement).getPropertyValue('--acc').trim();const t2=(ls().theme);return {acc:acc,cleared:!t2,ok:acc==='#00d4aa'&&!t2}}catch(e){return 'ERR:'+e.message}})()`);
  R('إعادة المظهر الافتراضي تعيد كل شيء', t && t.ok === true, typeof t === 'string' ? t : JSON.stringify(t));

  // ===== بند إصلاح 1: عنوان QUOTATION وكلمة الشحن =====
  // 29) الحفظ الصحيح: العنوان لا يُستبدل بكلمة الشحن + الحقول تُستعاد
  t = await js(`(function(){try{go('settings');stab('company');
document.getElementById('sqtx').value='عرض سعر خاص';
document.getElementById('sqshpLbl').value='التوصيل';
saveS();
var s1=ls();
var okSave=s1.quotationText==='عرض سعر خاص'&&s1.shippingLabel==='التوصيل';
document.getElementById('sqtx').value='x';document.getElementById('sqshpLbl').value='y';
ldSF();
var okLoad=document.getElementById('sqtx').value==='عرض سعر خاص'&&document.getElementById('sqshpLbl').value==='التوصيل';
// حالة كلمة شحن فارغة: العنوان يظل محفوظاً
document.getElementById('sqshpLbl').value='';saveS();
var okEmpty=ls().quotationText==='عرض سعر خاص'&&ls().shippingLabel==='';
ldSF();
return {okSave:okSave,okLoad:okLoad,okEmpty:okEmpty,ok:okSave&&okLoad&&okEmpty}}catch(e){return 'ERR:'+e.message}})()`);
  R('عنوان QUOTATION: يحفظ نصه ولا يتأثر بكلمة الشحن (ممتلئة أو فارغة) ويُستعاد', t && t.ok === true, typeof t === 'string' ? t : JSON.stringify(t));

  // ===== إصلاح 2: ملصق الباركود =====
  // 30) صنف بلا كود: يولّد كوداً تلقائياً + المودال يفتح بمعاينة باركود حقيقية
  t = await js(`(function(){try{localStorage.setItem('pq5_wi', JSON.stringify([{id:'wb1',code:'',name:'صنف بلا كود',unit:'قطعة',minQty:0,at:1}]));go('warehouse');whLabel('wb1');
const it=ld('pq5_wi').find(function(x){return x.id==='wb1'});
const prev=document.getElementById('wbcPrev');
const hasSvg=prev&&prev.querySelector('svg');
return {code:it?it.code:null,hasSvg:!!hasSvg,ok:!!(it&&it.code&&it.code.indexOf('P-')===0)&&!!hasSvg}}catch(e){return 'ERR:'+e.message}})()`);
  R('باركود لصنف بلا كود: توليد كود تلقائي + معاينة SVG فورية', t && t.ok === true, typeof t === 'string' ? t : JSON.stringify(t));

  // 31) المقاسات المخصصة + التفضيلات تُحفظ
  t = await js(`(function(){try{document.getElementById('wbcSize').value='custom';wbcOnSize();document.getElementById('wbcW').value='45';document.getElementById('wbcH').value='25';document.getElementById('wbcBcH').value='15';document.getElementById('wbcCopies').value='3';wbcPrev();
const prefCheck=_wbcSet();
return {dims:_wbcDims(),copies:prefCheck.copies,bch:prefCheck.bch,ok:_wbcDims()[0]===45&&_wbcDims()[1]===25&&prefCheck.copies==='3'&&prefCheck.bch==='15'}}catch(e){return 'ERR:'+e.message}})()`);
  R('مقاس مخصص 45×25 + تفضيلات القراءة سليمة', t && t.ok === true, typeof t === 'string' ? t : JSON.stringify(t));

  // ===== إصلاح 3: منتقي المنتجات يظهر فوق المودال =====
  // 32) فتح منتقي شحنة جديدة: fixed + داخل الشاشة + z-index عالٍ + مرئي
  t = await js(`(function(){try{go('shipping');openShp();document.getElementById('shpnm').value='عميل';
const btn=document.querySelector('#mShp .am button');
tglShpPP(btn);
const pp=document.getElementById('shppp');
const st=getComputedStyle(pp);
const r=pp.getBoundingClientRect();
const vis=st.display==='block'&&st.position==='fixed'&&parseInt(st.zIndex)>=200&&r.top>=0&&r.bottom<=window.innerHeight&&r.left>=0&&r.right<=window.innerWidth&&pp.querySelector('.pp-item, .pp-l div, div')!==null;
return {display:st.display,position:st.position,z:st.zIndex,top:Math.round(r.top),bottom:Math.round(r.bottom),vis:vis}}catch(e){return 'ERR:'+e.message}})()`);
  R('منتقي المنتجات في «شحنة جديدة» يظهر فوق كل شيء وداخل الشاشة', t && t.vis === true, typeof t === 'string' ? t : JSON.stringify(t));

  // ===== إصلاح 4: تهيئة أعمدة مدخل/مخرج جديد =====
  // 33) إخفاء المقاس واللون بالشيكبوكسات: جدول بسيط (صنف ثم كمية) مع حفظ القيم المخفية
  t = await js(`(function(){try{localStorage.setItem('pq5_p', JSON.stringify([{id:'p1',code:'P-1001',name:'صنف اختبار io',price:1,unit:'قطعة',at:1}]));localStorage.setItem('pq5_c', JSON.stringify([{id:'cl1',name:'عميل الفحص',phone:'0100',at:1}]));go('warehouse');whTab('io');openIo('in');
document.getElementById('iocl').value='cl1';
addProdToIo('p1');
const rows0=document.querySelectorAll('#ioib tr');const last0=rows0[rows0.length-1];
const sz0=last0.querySelector('.io-size');if(sz0)sz0.value='100';
const cl0=last0.querySelector('.io-color');if(cl0)cl0.value='أحمر';
last0.querySelector('.io-qty').value='5';
const preRows=document.querySelectorAll('#ioib tr').length;const preNamed=Array.from(document.querySelectorAll('#ioib .io-name')).filter(function(x){return x.value.trim()}).length;
document.getElementById('ioTSize').checked=false;ioTglSize();
document.getElementById('ioTColor').checked=false;ioTglColor();
const headers=Array.from(document.querySelectorAll('#mIo thead th')).map(function(th){return th.textContent.trim()});
const szGone=!document.querySelector('#ioib tr .io-size');
const rowAfter=document.querySelectorAll('#ioib tr');const prod=rowAfter[rowAfter.length-1];
const nameKept=prod&&prod.querySelector('.io-name').value.trim().length>0;
const qtyKept=prod&&prod.querySelector('.io-qty').value==='5';
const dbg='preRows='+preRows+' preNamed='+preNamed+' rows='+rowAfter.length+' names='+JSON.stringify(Array.from(rowAfter).map(function(r){return (r.querySelector('.io-name')||{}).value||''}));
return {headers:headers,szGone:szGone,nameKept:nameKept,qtyKept:qtyKept,dbg:dbg,ok:szGone&&nameKept&&qtyKept&&!headers.includes('المقاس')&&!headers.includes('اللون')}}catch(e){return 'ERR:'+e.message}})()`);
  R('مدخل جديد: إخفاء المقاس/اللون ← جدول صنف+كمية والقيم محفوظة', t && t.ok === true, typeof t === 'string' ? t : JSON.stringify(t));

  // 34) القيم المخفية تُحفظ في المستند وتُستعاد عند التحرير
  t = await js(`(function(){try{saveIo();const ios=ld('pq5_io');const d=ios[ios.length-1];
const savedHidden=d&&d.items.length&&d.items[0].size==='100'&&d.items[0].color==='أحمر'&&d.showSize===false&&d.showColor===false;
edIo(d.id);
const restoredHidden=document.querySelectorAll('#ioib tr .io-size').length===0&&ioShowSize===false;
return {savedHidden:!!savedHidden,restoredHidden:restoredHidden,ok:!!savedHidden&&restoredHidden}}catch(e){return 'ERR:'+e.message}})()`);
  R('حفظ القيم المخفية داخل المستند واستعادتها عند التحرير', t && t.ok === true, typeof t === 'string' ? t : JSON.stringify(t));

  // ===== نظام الباقات: البوابة والبطاقات =====
  // 35) هجرة _plans إلى v4: خمس باقات بأسعار وروابطها العشرة
  t = await js(`(function(){try{localStorage.setItem('pq5_s', JSON.stringify({_v:9, plans:{_v:3, solo:{m:19.99,y:199}}, payLinks:{_v:3, solo_m:'x'}}));const s=_plans();return {v:s.plans._v, fullPrice:s.plans.full&&s.plans.full.y, links:Object.keys(s.payLinks).filter(function(k){return k!=='_v'}).length, fullLink:(s.payLinks.full_y||'').indexOf('P-9KM50536NN239142UNLJPMYI')>=0}}catch(e){return 'ERR:'+e.message}})()`);
  R('هجرة v3→v4: خمس باقات و10 روابط جديدة', t && t.v === 4 && t.fullPrice === 940 && t.links === 10 && t.fullLink === true, typeof t === 'string' ? t : JSON.stringify(t));

  // 36) نافذة الترخيص: خمس بطاقات بوصف أقسامها
  t = await js(`(function(){try{openLicenseModal();const html=document.getElementById('subPlans').innerHTML;const cards=(html.match(/subPay\\('/g)||[]).length;return {cards:cards, hasFull:html.includes('الأفضل قيمة'), hasDesc:html.includes('المناقصات')&&html.includes('إيصالات النقدية'), ok:cards===5&&html.includes('الأفضل قيمة')}}catch(e){return 'ERR:'+e.message}})()`);
  R('نافذة الاشتراك: 5 بطاقات بوصف الأقسام', t && t.ok === true, typeof t === 'string' ? t : JSON.stringify(t));

  // 37) بوابة الأقسام: محاكاة باقة مالية (أقسام مالية+dash+settings فقط)
  t = await js(`(function(){try{_licSections=new Set(['dash','settings','payments','receivables','rcpt']);_licPkgName='باقة الأمور المالية';licApplySections2();function licApplySections2(){};applySidebarVisibility();
const hiddenQuotes=(function(){var el=Array.from(document.querySelectorAll('.sb-it')).find(function(i){return (i.getAttribute('onclick')||'').includes(\"go('quotes')\")});return el&&el.style.display==='none'})();
const visPay=(function(){var el=Array.from(document.querySelectorAll('.sb-it')).find(function(i){return (i.getAttribute('onclick')||'').includes(\"go('payments')\")});return el&&el.style.display===''})();
window._secGate=undefined;licApplySections();
return {hiddenQuotes:hiddenQuotes, visPay:visPay, ok:hiddenQuotes&&visPay}}catch(e){return 'ERR:'+e.message}})()`);
  R('البوابة: إخفاء خارج الباقة وإظهار داخلها بالشريط الجانبي', t && t.ok === true, typeof t === 'string' ? t : JSON.stringify(t));

  // ===== الإصلاح G+H: إعادة تسمية المستندات والشركة =====
  // 38) إعادة تسمية مجلد مستندات + مستند داخل مجلد (كانتا معطلتين بسبب prompt)
  t = await js(`(function(){try{localStorage.setItem('pq5_dc', JSON.stringify([{id:'dcf1',name:'ملف قديم',folder:true,parentId:null,files:[{id:'df1',title:'مستند قديم.pdf',name:'مستند قديم.pdf',data:'demo'}],at:1}]));
go('documents');
window.__pqPromptSim=true;
var _origPqPrompt=window.pqPrompt;window.pqPrompt=function(title,label,def,hint,cb){cb('ملف جديد تماماً')};
dcRenameFolderDlg('dcf1');
const folderRenamed=(ld('pq5_dc')[0].name==='ملف جديد تماماً');
window.pqPrompt=function(title,label,def,hint,cb){cb('مستند جديد.pdf')};
dcRenameFileDlg('dcf1','df1');
const fileRenamed=((ld('pq5_dc')[0].files||[])[0]||{}).title==='مستند جديد.pdf';
window.pqPrompt=_origPqPrompt;
return {folder:folderRenamed,file:fileRenamed,ok:folderRenamed&&fileRenamed}}catch(e){return 'ERR:'+e.message}})()`);
  R('إعادة تسمية مجلد ومستند بالمستندات تعملان (مودال موحد بدل prompt)', t && t.ok === true, typeof t === 'string' ? t : JSON.stringify(t));

  // 39) تعديل اسم شركة عبر IPC
  t = await js(`(async function(){try{const PQ=window.proquote;var cr=await PQ.companies.create('__شركة_تسمية__');if(!cr||!cr.ok)return 'create: '+(cr&&cr.error);
var rn=await PQ.companies.rename(cr.id,'__الاسم_الجديد__');
var lst=await PQ.companies.list();var found=lst.find(function(x){return x.id===cr.id});
var ok=rn&&rn.ok&&found&&found.name==='__الاسم_الجديد__';
var dup=await PQ.companies.rename(cr.id,'شركتي');
var dupBlocked=!(dup&&dup.ok);
await PQ.companies.remove(cr.id);
return {ok:ok,dupBlocked:dupBlocked,all:ok&&dupBlocked}}catch(e){return 'ERR:'+e.message}})()`);
  R('تعديل اسم شركة: يعمل + يرفض الاسم المكرر', t && t.all === true, typeof t === 'string' ? t : JSON.stringify(t));

  // ===== الموسم الجديد: طابعة البوليصة + منتقي + باركود =====
  // 40) طابعة البوليصة: بناء مقاس حراري 80مم + هيدر مضغوط + تفضيلات تُقرأ سليمة
  t = await js(`(function(){try{localStorage.setItem('pq5_wb', JSON.stringify([{id:'wbT1',number:'WB-777',date:'2026-01-01',clientName:'عميل طباعة',phone:'0100',address:'القاهرة',items:[{name:'صنف طباعة',size:'100',color:'أحمر',qty:5}],supplyNumber:'PO-1',at:1}]));
_pvCurDoc={kind:'waybill',id:'wbT1'};
document.getElementById('wbpSize').value='80xauto';document.getElementById('wbpHdr').value='50';document.getElementById('wbpTbl').value='70';document.getElementById('wbpCompactHdr').checked=true;document.getElementById('wbpShowSign').checked=false;
const p=_wbpSet();const html=_wbpBuild(p);
const dims=_wbpDims(p);
return {w:dims[0],hasNum:html.includes('WB-777'),hasItem:html.includes('صنف طباعة'),noSign:!html.includes('توقيع المستلم'),hasHdr:html.includes('font-weight:800'),ok:dims[0]===80&&html.includes('WB-777')&&html.includes('صنف طباعة')&&!html.includes('توقيع المستلم')}}catch(e){return 'ERR:'+e.message}})()`);
  R('طابعة البوليصة: بناء حراري 80مم بمقاسات مضغوطة بلا تواقيع', t && t.ok === true, typeof t === 'string' ? t : JSON.stringify(t));

  // 41) المنتقي يبقى مفتوحاً بعد نقرة الفتح (إصلاح الإغلاق الفوري)
  t = await js(`(async function(){try{go('dash');try{newQ()}catch(e){};const btn=document.querySelector('#mQ .am button');
tglPP(btn);
const pp=document.getElementById('pp');
const open1=pp.classList.contains('show');
pp.dispatchEvent(new MouseEvent('click',{bubbles:true}));
const stillOpen=pp.classList.contains('show');
await new Promise(function(res){setTimeout(res,250)});
const closedOutside=(function(){var probe=document.createElement('div');document.body.appendChild(probe);probe.dispatchEvent(new MouseEvent('click',{bubbles:true}));var closed=!pp.classList.contains('show');probe.remove();return closed})();
return {open1:open1,stillOpen:stillOpen,closedOutside:closedOutside,ok:open1&&stillOpen&&closedOutside}}catch(e){return 'ERR:'+e.message}})()`);
  R('منتقي «إضافة منتج»: يفتح ويبقى مفتوحاً ويغلق فقط من خارج', t && t.ok === true, typeof t === 'string' ? t : JSON.stringify(t));

  // 42) باركود: إخفاء الباركود يخفيه والاسم/الكود بالأسود
  t = await js(`(function(){try{localStorage.setItem('pq5_wi', JSON.stringify([{id:'wbB1',code:'P-9',name:'صنف أسود',unit:'قطعة',minQty:0,at:1}]));whLabel('wbB1');
const prevFull=document.getElementById('wbcPrev');
document.getElementById('wbcShowBc').checked=false;wbcPrev();
const html=prevFull.innerHTML;
const noSvg=!html.includes('<svg');
const black=html.includes('color:#000');
document.getElementById('wbcShowBc').checked=true;wbcPrev();
const withSvg=prevFull.innerHTML.includes('<svg');
return {noSvg:noSvg,black:black,withSvg:withSvg,ok:noSvg&&black&&withSvg}}catch(e){return 'ERR:'+e.message}})()`);
  R('ملصق الباركود: إخفاء الباركود يعمل + كل النصوص بالأسود', t && t.ok === true, typeof t === 'string' ? t : JSON.stringify(t));

  const passed = out.filter((l) => l.startsWith('✅')).length;
  log('=== ' + passed + '/' + (out.length) + ' ===');
  const report = path.join(app.getPath('userData'), '..', 'pq-uitest-report.txt');
  try { fs.writeFileSync('C:/Users/java/AppData/Local/Temp/pq-uitest-report.txt', out.join('\n'), 'utf8'); } catch (_) {}
  console.log(out.join('\n'));
  app.exit(0);
}

module.exports = { isolate, run };
