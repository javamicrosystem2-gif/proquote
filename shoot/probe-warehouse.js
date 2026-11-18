// ============================================================
// ProQuote — الفحص الحي لقسم المخزن والإدخال المتعدد (--probe-warehouse)
// يغطي إصلاح «الأصناف والمنتجات لا تظهر»: منتقى موحد + إنشاء
// صنف تلقائي عند الحفظ + الربط بالكود/الاسم + تهريب HTML.
// ============================================================
'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const REPORT = path.join(os.tmpdir(), 'pq-probe-warehouse-report.txt');

function isolate() {
  const dir = path.join(os.tmpdir(), 'pq-probe-warehouse-data');
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

    // بيانات أولية: أصناف مخزن فقط — بلا أي منتجات (سيناريو المستخدم الشاكي)
    await wc.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
    await sleep(4000);
    await js(`(function(){
      localStorage.setItem('pq5_wh', JSON.stringify([{id:'wh1',name:'المخزن الرئيسي',at:1}]));
      localStorage.setItem('pq5_wi', JSON.stringify([
        {id:'wi1',code:'WH-0001',name:'رول بلاستيك 50سم',unit:'رول',minQty:0,img:'',at:1},
        {id:'wi2',code:'WH-0002',name:'كيس سماد 25كجم',unit:'كيس',minQty:0,img:'',at:2}]));
      localStorage.setItem('pq5_wm','[]');
      localStorage.setItem('pq5_p','[]');
      return true})()`);
    await js(`(function(){go('warehouse');return true})()`);
    await sleep(1200);

    // ===== 1) المنتقي يعرض أصناف المخزن (كان يعرض «لا توجد منتجات») =====
    await js(`(function(){openMvDoc('in');return true})()`);
    await sleep(600);
    await js(`(function(){try{tglMvPP(document.querySelector('#mMv .am button'))}catch(e){};return true})()`);
    await sleep(600);
    let t = await js(`(function(){var l=document.getElementById('mvppL');return l?l.textContent:'NO'})()`);
    R('المنتقي يعرض أصناف المخزن (بلا منتجات بالمشروع) مع أرصدتها', (t || '').indexOf('رول بلاستيك') >= 0 && (t || '').indexOf('أصناف المخزن') >= 0, '');

    // ===== 2) إضافة صنف من المنتقي → صف مربوط بمعرف الصنف مباشرة =====
    await js(`(function(){addItemToMv('wi1');return true})()`);
    t = await js(`(function(){var r=document.querySelector('#mvib tr[data-wid]');return r?r.getAttribute('data-wid')==='wi1'&&r.querySelector('.mv-name').value.indexOf('رول بلاستيك')>=0:null})()`);
    R('إضافة صنف من المنتقي: صف مربوط بمعرف الصنف (wid)', t === true);
    await js(`(function(){cm('mMv');return true})()`);
    await sleep(400);

    const setQty=(nm,q)=>{const ins=Array.from(document.querySelectorAll('#mvib .mv-name'));const el=ins.find(function(i){return i.value.indexOf(nm)>=0});if(el)el.closest('tr').querySelector('.mv-qty').value=q};
    // ===== 3) منتج بلا مقابل بالمخزن → يظهر بالمنتقي بشارة الإنشاء → حفظ → صنف جديد بالمخزن برصيد صحيح =====
    await js(`(function(){
      localStorage.setItem('pq5_p', JSON.stringify([{id:'pr1',code:'PR-777',name:'قفازات عمل زرقاء',price:20,unit:'زوج',at:3}]));
      return true})()`);
    await js(`(function(){openMvDoc('in');return true})()`);
    await sleep(500);
    await js(`(function(){try{tglMvPP(document.querySelector('#mMv .am button'))}catch(e){};return true})()`);
    await sleep(500);
    t = await js(`(function(){var l=document.getElementById('mvppL');return l?l.textContent.indexOf('قفازات عمل')>=0&&l.textContent.indexOf('يُنشأ لها صنف')>=0:null})()`);
    R('منتج بلا مقابل: يظهر بقسم «يُنشأ لها صنف بالمخزن عند الحفظ»', t === true);

    await js(`(function(){addProdToMv('pr1');
      // صف يدوي بكود مخصص + صف باسم بعلامة تنصيص
      addMvRow({name:'سلك نحاس 2مم',code:'CU-2MM',unit:'متر',qty:15});
      addMvRow({name:'صنف "مختبر" بعلامة تنصيص',code:'',unit:'قطعة',qty:2});
      return true})()`);
    // الصف بعلامة التنصيص يظهر سليماً (value مهربة)
    t = await js(`(function(){var ins=Array.from(document.querySelectorAll('#mvib .mv-name'));var q=ins.find(function(i){return i.value.indexOf('مختبر')>=0});return q?q.value.indexOf('"')>=0:null})()`);
    R('اسم يحوي علامة تنصيص " يظهر سليماً بالصف (تهريب HTML)', t === true);

    // الكميات ثم الحفظ
    await js("(function(){var ins=Array.from(document.querySelectorAll('#mvib .mv-name'));var el=ins.find(function(i){return i.value.indexOf('قفازات')>=0});if(el)el.closest('tr').querySelector('.mv-qty').value=10;return true})()");
    await js(`(function(){cfMv();return true})()`);
    await sleep(900);

    t = await js(`(function(){
      var wis=JSON.parse(localStorage.getItem('pq5_wi')||'[]');
      var g=wis.find(w=>w.code==='PR-777');var c=wis.find(w=>w.code==='CU-2MM');var q=wis.find(w=>(w.name||'').indexOf('مختبر')>=0);
      var ms=JSON.parse(localStorage.getItem('pq5_wm')||'[]');
      var allLinked=ms.length===3&&ms.every(m=>m.itemId);
      return JSON.stringify({g:!!g,gStock:g?whStock(g.id):null,c:!!c,cStock:c?whStock(c.id):null,q:!!q,qStock:q?whStock(q.id):null,linked:allLinked,n:wis.length})})()`);
    const r3 = JSON.parse(t || '{}');
    R('حفظ الإدخال المتعدد: أُنشئت الأصناف الثلاثة تلقائياً (منتج PR-777 + يدوي CU-2MM + اسم بتنصيص)', r3.g && r3.c && r3.q && r3.n === 5, 'أصناف المخزن: ' + r3.n);
    R('الرصيد صحيح فوراً: 10 / 15 / 2', r3.gStock === 10 && r3.cStock === 15 && r3.qStock === 2, JSON.stringify({g:r3.gStock,c:r3.cStock,q:r3.qStock}));
    R('كل الحركات مرتبطة بمعرفات أصناف (لا حركات يتيمة)', r3.linked === true);

    // ===== 4) جدول المخزن يعرض الجديد بالفعل =====
    t = await js(`(function(){var tb=document.getElementById('whTb');var x=tb?tb.textContent:'';return x.indexOf('قفازات عمل زرقاء')>=0&&x.indexOf('سلك نحاس')>=0&&x.indexOf('مختبر')>=0})()`);
    R('جدول قسم المخزن يعرض الأصناف المضافة كلها', t === true);

    // ===== 5) مطابقة الاسم: منتج بنفس اسم صنف موجود (كود مختلف) → ربط بلا تكرار =====
    await js(`(function(){
      localStorage.setItem('pq5_p', JSON.stringify([{id:'pr2',code:'PR-888',name:'رول بلاستيك 50سم',price:100,unit:'رول',at:4}]));
      openMvDoc('in');return true})()`);
    await sleep(500);
    await js(`(function(){addProdToMv('pr2');
      var ins=Array.from(document.querySelectorAll('#mvib .mv-name'));var el=ins.find(function(i){return i.value.indexOf('رول بلاستيك')>=0});if(el)el.closest('tr').querySelector('.mv-qty').value=5;cfMv();return true})()`);
    await sleep(900);
    t = await js(`(function(){
      var wis=JSON.parse(localStorage.getItem('pq5_wi')||'[]');
      var dup=wis.filter(w=>w.name==='رول بلاستيك 50سم').length;
      var st=whStock('wi1');
      return JSON.stringify({dup:dup,stock:st})})()`);
    const r5 = JSON.parse(t || '{}');
    R('منتج باسم مطابق لصنف موجود (كود مختلف): ارتبط به ولم يتكرر ورصيده 0+5=5', r5.dup === 1 && r5.stock === 5, JSON.stringify(r5));

    // ===== 6) إخراج متعدد ينقص من نفس الأصناف =====
    await js(`(function(){openMvDoc('out');return true})()`);
    await sleep(400);
    await js(`(function(){addItemToMv('wi1');
      var ins=Array.from(document.querySelectorAll('#mvib .mv-name'));var el=ins.find(function(i){return i.value.indexOf('رول بلاستيك')>=0});if(el)el.closest('tr').querySelector('.mv-qty').value=3;cfMv();return true})()`);
    await sleep(900);
    t = await js('(function(){return whStock("wi1")})()');
    R('إخراج متعدد ينقص الرصيد: 5 - 3 = 2', t === 2, 'الرصيد: ' + t);

    const pass = out.filter((l) => l.startsWith('✅')).length;
    const fail = out.filter((l) => l.startsWith('✗')).length;
    log('===== PROBE WAREHOUSE: ' + pass + ' PASS / ' + fail + ' FAIL =====');
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
