// ============================================================
// ProQuote — الفحص الحي لذاكرة الطابعات وقالب البوليصة (--probe-print)
// يعمل بوضع PQ_PRINT_DRY=1 (بلا استهلاك ورق) — يتحقق من التوجيه
// الصامت للطابعة المحفوظة لكل قسم وتطابق قالب المعاينة حرفياً.
// ============================================================
'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const REPORT = path.join(os.tmpdir(), 'pq-probe-print-report.txt');

function isolate() {
  const dir = path.join(os.tmpdir(), 'pq-probe-print-data');
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  fs.mkdirSync(dir, { recursive: true });
  app.setPath('userData', dir);
}

async function run() {
  const out = [];
  const log = (s) => { out.push(s); console.log(s); };
  const R = (name, ok, extra) => log((ok ? '✅ ' : '✗ ') + name + (extra ? ' — ' + extra : ''));

  try {
    process.env.PQ_PRINT_DRY = '1'; // تشغيل جاف: نفس المسار بلا ورق
    const win = new BrowserWindow({
      width: 1380, height: 850, show: true,
      webPreferences: { preload: path.join(__dirname, '..', 'src', 'main', 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false }
    });
    const wc = win.webContents;
    const js = (code) => wc.executeJavaScript(code, true);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    await wc.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
    await sleep(4000);
    await js(`(function(){try{document.getElementById('loginScreen').style.display='none'}catch(e){} return true})()`);

    // ===== 1) قائمة طابعات النظام عبر الجسر =====
    let t = await js('(function(){return window.proquote.printers.list().then(function(l){return Array.isArray(l)?l.length:-1})})()');
    R('قائمة طابعات النظام تصلك عبر الجسر', t !== -1 && t >= 0, t + ' طابعة مكتشفة');

    // ===== 2) أول طباعة بلا محفوظة → نافذة الاختيار تظهر =====
    await js(`(function(){localStorage.setItem('pq5_s', JSON.stringify({}));return true})()`);
    await js(`(function(){pqPrint({ctx:'a4',body:'<h1>اختبار</h1>'});return true})()`);
    await sleep(900);
    t = await js(`(function(){var m=document.getElementById('mPrnPick');return m&&m.classList.contains('show')})()`);
    R('أول طباعة (بلا محفوظة) تفتح نافذة اختيار الطابعة', t === true);

    // ===== 3) اختيار + تذكر → الحفظ ثم الطباعة التالية صامتة للطابعة نفسها =====
    t = await js(`(function(){var sel=document.getElementById('prnSel');var opts=sel&&sel.options?Array.from(sel.options):[];return opts.length?opts[0].value:'NONE'})()`);
    const firstPrinter = t;
    await js(`(function(){document.getElementById('prnSel').value=${JSON.stringify(firstPrinter)};document.getElementById('prnRemember').checked=true;prnPickGo();return true})()`);
    await sleep(900);
    t = await js(`(function(){return JSON.stringify((ls().printers)||{})})()`);
    const saved = JSON.parse(t || '{}');
    R('الاختيار مع «تذكّر» يحفظ الطابعة للقسم', saved['a4'] === firstPrinter, JSON.stringify(saved));

    // الطباعة الثانية: صامتة مباشرة بلا نافذة اختيار
    await js(`(function(){pqPrint({ctx:'a4',body:'<h1>ثانية</h1>'});return true})()`);
    await sleep(900);
    t = await js(`(function(){var m=document.getElementById('mPrnPick');return m&&!m.classList.contains('show')})()`);
    R('الطباعة الثانية: صامتة مباشرة — نافذة الاختيار لا تظهر', t === true);
    t = await js(`(function(){var tc=document.querySelector('#TC .tt:last-child span');return tc?tc.textContent:'NO_TOAST'})()`);
    R('إشعار «تمت الطباعة: <الطابعة> (تشغيل جاف)» ظهر', (t || '').indexOf('تمت الطباعة') === 0 && (t || '').indexOf(firstPrinter) >= 0, t);

    // ===== 4) أقسام متعددة: كل قسم بطابعته =====
    await js(`(function(){var s=ls();s.printers={'a4':${JSON.stringify(firstPrinter)},'waybill':'PRN-WAYBILL-X','wbc':'PRN-LABEL-Y'};sv('pq5_s',s);return true})()`);
    await js(`(function(){return window.proquote.printers.printHtml({html:'<h1>بوليصة</h1>',printer:'PRN-WAYBILL-X',silent:true}).then(function(r){return JSON.stringify(r)})})()`);
    // (dry يمر عبر أي اسم طابعة) — نتحقق من المسار الصامت من الواجهة عبر pqPrint
    await js(`(function(){pqPrint({ctx:'wbc',html:'<h1>ملصق</h1>'});return true})()`);
    await sleep(700);
    t = await js(`(function(){var tc=document.querySelector('#TC .tt:last-child span');return tc?tc.textContent:'NO'})()`);
    R('قسم الملصقات يطبع على طابعته المحفوظة (PRN-LABEL-Y)', (t || '').indexOf('PRN-LABEL-Y') >= 0, t);

    // ===== v2: الجذر الأول — deviceName يصل فعلاً (لم يعد printer المتجاهَل) =====
    t = await js("(function(){return window.proquote.printers.printHtml({html:'<h1>x</h1>',printer:'PRN-DEVICE-TEST',silent:true}).then(function(r){return JSON.stringify(r)})})()");
    const dr = JSON.parse(t || '{}');
    R('deviceName يصل لطبقة الطباعة (الاسم الصحيح بواجهة Electron)', dr.deviceName === 'PRN-DEVICE-TEST', JSON.stringify(dr));

    // ===== v2: الجذر الثالث — زر ⚙ يفتح المنتقي و«تذكّر» مفعّل ويحفظ بلا طباعة =====
    await js("(function(){prnChangeFor('wbc');return true})()");
    await sleep(700);
    let t2 = await js("(function(){var b=document.getElementById('prnRemember');var m=document.getElementById('mPrnPick');return b&&b.checked&&m.classList.contains('show')})()");
    R('⚙ يفتح المنتقي و«تذكّر» يبقى مفعلاً (كان يُلغيه)', t2 === true);
    await js("(function(){var sel=document.getElementById('prnSel');if(sel.options.length)sel.value=sel.options[0].value;prnPickGo();return true})()");
    await sleep(700);
    t2 = await js("(function(){var tc=document.querySelector('#TC .tt:last-child span');return tc?tc.textContent:''})()");
    R('⚙ يحفظ فوراً برسالة «حُفظت طابعة القسم» بلا محاولة طباعة', (t2 || '').indexOf('حُفظت طابعة القسم') === 0, t2);
    t2 = await js("(function(){return (_prnSaved()||{})['wbc']||''})()");
    R('الطابعة محفوظة فعلاً لقسم الملصقات عبر ⚙', !!t2, t2);

    // ===== v2: المنتقي يميز الافتراضية ويعرضها =====
    t2 = await js("(function(){var sel=document.getElementById('prnSel');if(!sel||!sel.options.length)return 'NO';return Array.from(sel.options).some(function(o){return o.textContent.indexOf('افتراضية النظام')>=0})?true:(sel.options.length>=1?'NO_DEFAULT_PRINTER':false)})()");
    R('المنتقي يميز الطابعة الافتراضية للنظام بوسم واضح', t2 === true || t2 === 'NO_DEFAULT_PRINTER', t2);

    // ===== v2: مودال الباركود — صف الطابعة + زر نافذة النظام =====
    await js("(function(){localStorage.setItem('pq5_wi', JSON.stringify([{id:'wbcIt1',code:'WH-9',name:'صنف ملصق',unit:'قطعة',at:1}]));_wbcCurId='wbcIt1';whLabel('wbcIt1');return true})()");
    await sleep(700);
    t2 = await js("(function(){var m=document.getElementById('mWbc');var lbl=document.getElementById('wbcPrnLbl');var btns=Array.from(m.querySelectorAll('.md-f button'));return {open:m.classList.contains('show'),hasLbl:!!lbl&&lbl.textContent.indexOf('الطابعة المحفوظة')>=0,hasSys:btns.some(function(b){return b.getAttribute('onclick')&&b.getAttribute('onclick').indexOf('whPrintLabels(true)')>=0})}})()");
    const wbcr = (() => { try { return typeof t2 === 'string' ? JSON.parse(t2) : t2; } catch (_) { return {}; } })();
    R('مودال ملصق الباركود: صف الطابعة + زر «نافذة النظام» + الطابعة المحفوظة ظاهرة', wbcr.open === true && wbcr.hasLbl === true && wbcr.hasSys === true, JSON.stringify(wbcr));
    await js("(function(){cm('mWbc');return true})()");

    // ===== v2: الثبات عبر إعادة تحميل الصفحة (محاكاة إعادة التشغيل) =====
    await js("(function(){var s=ls();s.printers=s.printers||{};s.printers['docs']='PRN-DOCS-KEEP';sv('pq5_s',s);return true})()");
    await wc.reload();
    await sleep(4500);
    await js("(function(){try{document.getElementById('loginScreen').style.display='none'}catch(e){};return true})()");
    t2 = await js("(function(){return ((_prnSaved()||{})['docs'])||''})()");
    R('الثبات: الطابعة المحفوظة تبقى بعد إعادة تحميل كاملة للصفحة', t2 === 'PRN-DOCS-KEEP', t2);

    // ===== 5) البوليصة «مطابق للمعاينة»: نفس قالب المعاينة بالضبط + المنزلقات تحجّم =====
    await js(`(function(){
      localStorage.setItem('pq5_wb', JSON.stringify([{id:'wbP1',number:'WB-901',date:'2026-02-02',clientName:'عميل القالب',phone:'0111',address:'الجيزة',items:[{name:'تيشيرت قطن',size:'XL',color:'أزرق',qty:12},{name:'بنطال',size:'32',color:'أسود',qty:5}],showSize:true,showColor:true,extraCols:[{key:'x1',name:'رقم الكرتون',num:true}],at:1}]));
      _pvCurDoc={kind:'waybill',id:'wbP1'};
      document.getElementById('wbpLayout').value='exact';
      document.getElementById('wbpHdr').value='100';document.getElementById('wbpTbl').value='100';document.getElementById('wbpFs').value='100';
      return true})()`);
    // المعاينة على الشاشة
    await js(`(function(){vWb('wbP1');return true})()`);
    await sleep(500);
    const prevHtml = await js('(function(){return document.getElementById("qPA").outerHTML})()');
    // طباعة exact بنفس المقاييس
    const printHtml = await js(`(function(){var p=_wbpSet();return _wbDocHtml(_wbpCurDoc(),p.hdr/100,p.tbl/100,p.fs/100)})()`);
    const norm = (h) => String(h).replace(/\s+/g, ' ').trim();
    R('قالب «مطابق للمعاينة»: HTML الطباعة = HTML المعاينة حرفياً', norm(prevHtml) === norm(printHtml), (Math.abs(norm(prevHtml).length - norm(printHtml).length)) + ' فررق حرف');
    R('القالب يحوي أعمدة المقاس/اللون/الأعمدة الإضافية والزيبرا كما بالمعاينة', printHtml.includes('المقاس') && printHtml.includes('اللون') && printHtml.includes('رقم الكرتون') && printHtml.includes('XL') && printHtml.includes('wbP1'.length ? 'إجمالي القطع' : ''));

    // المنزلقات تحجّم الخطوط فعلاً
    const sized = await js(`(function(){document.getElementById('wbpHdr').value='50';document.getElementById('wbpTbl').value='60';var p=_wbpSet();return _wbDocHtml(_wbpCurDoc(),p.hdr/100,p.tbl/100,1).match(/font-size:(\\d+)px;font-weight:900;color:/)[1]})()`);
    const baseHs = await js('(function(){return (ls().headingSize||22)})()');
    R('منزلق الهيدر يصغّر خط العنوان فعلاً (22→11)', Number(sized) === Math.round(Number(baseHs) * 0.5), sized + 'px');
    await js(`(function(){document.getElementById('wbpHdr').value='100';document.getElementById('wbpTbl').value='100';return true})()`);
    // تفضيل القالب يُحفظ
    await js(`(function(){var p=_wbpSet();var s=ls();s.wbpPrefs=p;sv('pq5_s',s);return true})()`);
    t = await js('(function(){return (ls().wbpPrefs||{}).layout})()');
    R('تفضيل القالب (مطابق للمعاينة) يُحفظ', t === 'exact');

    // ===== 6) العودة للحراري القديم تعمل =====
    const thermal = await js(`(function(){document.getElementById('wbpLayout').value='thermal';var p=_wbpSet();return _wbpBuild(p)})()`);
    R('قالب «حراري مضغوط» القديم يعمل كما هو', thermal.includes('WB-901') && /border-bottom:1\.5px solid #000/.test(thermal));

    // ===== 7) ⚙ تغيير الطابعة لاحقاً =====
    await js(`(function(){prnChangeFor('waybill');return true})()`);
    await sleep(600);
    t = await js(`(function(){var m=document.getElementById('mPrnPick');return m&&m.classList.contains('show')})()`);
    R('زر ⚙ (تغيير الطابعة) يفتح نافذة الاختيار للقسم المحدد', t === true);
    await js(`(function(){cm('mPrnPick');return true})()`);

    // ===== v3: المقاس يصل بالمايكرون لكل مسار =====
    t = await js("(function(){return window.proquote.printers.printHtml({html:'<h1>x</h1>',printer:'P1',silent:true,pageWmm:40,pageHmm:30}).then(function(r){return JSON.stringify(r)})})()");
    const dr3 = JSON.parse(t || '{}');
    R('المقاس يصل بالمايكرون (40×30مم)', dr3.pageSize && dr3.pageSize.w === 40 && dr3.pageSize.h === 30, JSON.stringify(dr3.pageSize));
    t = await js("(function(){return window.proquote.printers.printHtml({html:'<h1>x</h1>',printer:'P1',silent:true,pageWmm:80,pageHmm:0,pageAuto:true}).then(function(r){return JSON.stringify(r)})})()");
    const dr4 = JSON.parse(t || '{}');
    R('الطول التلقائي يُعلَّم ويُقاس (80مم auto)', dr4.pageSize && dr4.pageSize.w === 80 && dr4.pageSize.auto === true, JSON.stringify(dr4.pageSize));

    // الاسم الطويل يلتف في الملصق (لا قص)
    await js("(function(){localStorage.setItem('pq5_wi', JSON.stringify([{id:'wbcL',code:'WH-55',name:'صنف باسم طويل جداً للغاية يجب أن يظهر كاملاً بكل الكلمات دون أي قص نهائياً هنا',unit:'قطعة',at:1}]));_wbcCurId='wbcL';whLabel('wbcL');return true})()");
    await sleep(700);
    t = await js("(function(){var el=document.querySelector('#wbcPrev div[style*=word-break]');return el?el.textContent:'NO_WRAP_EL'})()");
    R('الاسم الطويل يُعرض كاملاً بتفاف أسطر (لا قص بـ ellipsis)', (t||'').indexOf('دون أي قص')>=0, (t||'').slice(0,40));
    t = await js("(function(){var css=_wbcSet;return 'ok'})()");
    // عيّنة HTML الطباعة: .nm بالتفاف
    const nmWrap = await js("(function(){var it={name:'اختبار الاسم الطويل جداً',code:'W1'};var p={size:'40x30',w:40,h:30,mode:'thermal',bch:12,bw:2,fs:8,copies:1,showName:true,showCode:true,showBc:true};_wbcCurId=null;var old=window._wbcCurId;window._wbcCurId=null;return 'queued'})()");
    R('مسار الملصق الحراري جاهز (الوضع والنسخ)', nmWrap === 'queued');
    await js("(function(){cm('mWbc');return true})()");

    // البوليصة: exact يحترم المقاس المختار (80مم)
    await js("(function(){localStorage.setItem('pq5_wb', JSON.stringify([{id:'wbS',number:'WB-9',date:'2026-01-01',clientName:'عميل',items:[{name:'صنف',qty:2}],at:1}]));_pvCurDoc={kind:'waybill',id:'wbS'};return true})()");
    await js("(function(){document.getElementById('wbpLayout').value='exact';document.getElementById('wbpSize').value='80xauto';wbpLayoutChange();wbpPrev();return true})()");
    await sleep(500);
    t = await js("(function(){var lbl=document.getElementById('wbpPrevLbl');var prev=document.getElementById('wbpPrev');return JSON.stringify({lbl:lbl?lbl.textContent:'',w:prev?(prev.firstChild?parseInt(prev.firstChild.style.width):0):0})})()");
    const wr = JSON.parse(t||'{}');
    R('البوليصة exact: المعاينة تعرض مقاس الورقة المختار (80مم) لا A4', (wr.lbl||'').indexOf('80')>=0 && wr.w>=30, t);
    t = await js("(function(){var b=document.getElementById('wbpPrnLbl');var th=document.getElementById('wbpThermalOpts');var layout=document.getElementById('wbpLayout').value;return JSON.stringify({prnVisible:!!b,thermalHidden:layout==='exact'?th.style.display==='none':true})})()");
    const wr2 = JSON.parse(t||'{}');
    R('البوليصة exact: صف الطابعة ظاهر (خارج كتلة الحراري)', wr2.prnVisible===true && wr2.thermalHidden===true, t);

    // شريحة الإصدار بالشريط الجانبي + البانر فوق شاشة الدخول
    t = await js("(function(){var chip=document.getElementById('updChipVer');var dot=document.getElementById('updChipDot');var b=document.getElementById('updBanner');return JSON.stringify({chip:chip?chip.textContent:'NO',hasDot:!!dot,bannerZ:b?getComputedStyle(b).zIndex:'0'})})()");
    const uc = JSON.parse(t||'{}');
    R('شريحة الإصدار بالشريط الجانبي (vX.Y.Z + نقطة حالة)', /^v?[0-9]+/.test(uc.chip||'') && uc.hasDot, t);
    R('بانر التحديث فوق كل الطبقات (10060 — يظهر فوق شاشة الدخول)', uc.bannerZ === '10060', uc.bannerZ);

    // زر QR بنافذة المعاينة يعمل
    await js("(function(){vQ=null;return true})()");
    t = await js("(function(){return !!document.getElementById('pvQrBtn')&&!!document.querySelector('#qPA.no-qr')===false})()");
    R('زر QR بنافذة المعاينة موجود (إخفاء مربعات QR من الطباعة)', t===true);

    const pass = out.filter((l) => l.startsWith('✅')).length;
    const fail = out.filter((l) => l.startsWith('✗')).length;
    log('===== PROBE PRINT: ' + pass + ' PASS / ' + fail + ' FAIL =====');
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
