const { app, BrowserWindow } = require('electron');
const path=require('path'),fs=require('fs'),os=require('os');
const ud=path.join(os.tmpdir(),'pq-dbg-recv');try{fs.rmSync(ud,{recursive:true,force:true})}catch(e){};fs.mkdirSync(ud,{recursive:true});
app.setPath('userData',ud);
app.whenReady().then(async()=>{
  const w=new BrowserWindow({show:false,webPreferences:{preload:path.join(__dirname,'src','main','preload.js'),contextIsolation:true,sandbox:false}});
  await w.webContents.loadFile(path.join(__dirname,'src','renderer','index.html'));
  await new Promise(r=>setTimeout(r,4000));
  const js=(c)=>w.webContents.executeJavaScript(c,true);
  await js(`(function(){try{document.getElementById('loginScreen').style.display='none'}catch(e){};return true})()`);
  const out=[];
  const R=(n,o)=>out.push((o===true?'✅ ':'✗ ')+n+(o===true?'':' — '+String(o).slice(0,150))));
  // بيانات: أمر توريد بمبلغ 5000
  await js(`(function(){localStorage.setItem('pq5_so', JSON.stringify([{id:'soR',number:'SO-901',date:'2026-01-01',clientName:'شركة النور',subject:'توريد',totalAmount:5000,paidAmount:0,payments:[],status:'working',at:1}]));localStorage.setItem('pq5_pay','[]');return true})()`);
  // 1) الزر موجود بالشريط
  let t=await js(`(function(){var b=Array.from(document.querySelectorAll('#p-payments .btn')).find(function(x){return x.getAttribute('onclick')&&x.getAttribute('onclick').indexOf('openSoRecvPay')>=0});return b?b.textContent.trim():'NO_BTN'})()`);
  R('زر «إضافة دفعة مستلمة» بقسم المدفوعات الخارجية',t.indexOf('إضافة دفعة مستلمة')>=0,t);
  // 2) المودال يفتح ويعرض أمر التوريد والمتبقي
  await js(`(function(){openSoRecvPay();return true})()`);
  await new Promise(r=>setTimeout(r,400));
  t=await js(`(function(){var m=document.getElementById('mSoRecvPay');var sel=document.getElementById('soRecvSo');var info=document.getElementById('soRecvInfo');return JSON.stringify({open:m.classList.contains('show'),opt:sel.options.length?sel.options[0].textContent:'',total:(document.getElementById('soRecvTotal').textContent||''),remain:(document.getElementById('soRecvRemain').textContent||''),amt:(document.getElementById('soRecvAmount').value||'')})})()`);
  const r2=JSON.parse(t||'{}');
  R('المودال: أمر التوريد معروض والإجمالي 5000 والمتبقي يملأ المبلغ تلقائياً',r2.open&&r2.opt.indexOf('SO-901')>=0&&r2.total.indexOf('5000')>=0&&r2.amt==='5000',t);
  // 3) حفظ دفعة جزئية 2000
  await js(`(function(){document.getElementById('soRecvAmount').value='2000';saveSoRecvPay();return true})()`);
  await new Promise(r=>setTimeout(r,400));
  t=await js(`(function(){var d=JSON.parse(localStorage.getItem('pq5_so'))[0];return JSON.stringify({pays:(d.payments||[]).length,amt:d.payments[0].amount,paid:d.paidAmount,st:d.paymentStatus})})()`);
  const r3=JSON.parse(t||'{}');
  R('حفظ دفعة 2000: سجلت وpaidAmount=2000 والحالة جزئي',r3.pays===1&&r3.amt===2000&&r3.paid===2000&&r3.st==='partial_paid',t);
  // 4) دفعة ثانية تكمل
  await js(`(function(){openSoRecvPay();document.getElementById('soRecvAmount').value='3000';saveSoRecvPay();return true})()`);
  await new Promise(r=>setTimeout(r,400));
  t=await js(`(function(){var d=JSON.parse(localStorage.getItem('pq5_so'))[0];return JSON.stringify({pays:(d.payments||[]).length,paid:d.paidAmount,st:d.paymentStatus})})()`);
  const r4=JSON.parse(t||'{}');
  R('دفعة ثانية 3000: الاكتمال paid=5000 والحالة complete',r4.pays===2&&r4.paid===5000&&r4.st==='complete',t);
  // 5) مودال إضافة دفعة بأمر التوريد القديم يظل يعلم بنفس البيانات (تكامل)
  t=await js(`(function(){var d=JSON.parse(localStorage.getItem('pq5_so'))[0];_soPayTargetId=d.id;_rdrPayInsts();var tb=document.getElementById('payInstList');return (d.payments||[]).length>=2&&tb.textContent.indexOf('2000')>=0})()`);
  R('تكامل: نافذة «إضافة دفعة» بأمر التوريد تعرض نفس الدفعات',t===true);
  console.log(out.join('\n'));
  console.log('===== RECV: '+out.filter(l=>l.startsWith('✅')).length+' PASS / '+out.filter(l=>l.startsWith('✗')).length+' FAIL =====');
  app.exit(out.some(l=>l.startsWith('✗'))?1:0);
});
