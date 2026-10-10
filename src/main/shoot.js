// ============================================================
// ProQuote — حاصاد لقطات التسويق (وضع المطور فقط: --shoot)
// يعمل على مجلد userData معزول في TEMP مع بيانات تجرية وهمية،
// ولا يلمس بيانات المستخدم الحقيقية في %APPDATA%\ProQuote إطلاقاً.
// الاستخدام:  npx electron . --shoot
// الخرج:      landing/img/sec-<id>.png + sec-<id>-en.png
// ============================================================
'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const buildDemoData = require('../../shoot/demo-data');

// ترتيب الأقسام كما في الشريط الجانبي
const SECTIONS = [
  'dash', 'quotes', 'tech', 'receipt', 'auth', 'custom', 'full', 'samples',
  'supply', 'returns', 'tenders', 'shipping',
  'payments', 'receivables', 'rcpt',
  'clients', 'products', 'warehouse', 'mfg', 'documents', 'emp', 'notes',
  'ei', 'adm', 'settings',
];

const OUT_DIR = path.join(__dirname, '..', '..', 'landing', 'img');
const BOOT_WAIT = 4000;       // مهلة الإقلاع بعد التحميل (usrBoot/cloudBoot)
const RENDER_WAIT = 1700;     // مهلة رسم القسم قبل الالتقاط

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// يُنادى قبل app.whenReady في main.js عند وجود --shoot
function isolateUserData() {
  const dir = path.join(os.tmpdir(), 'pq-shoot-data');
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  fs.mkdirSync(dir, { recursive: true });
  app.setPath('userData', dir);
  return dir;
}

async function run() {
  console.log('[shoot] userData المعزول:', app.getPath('userData'));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const win = new BrowserWindow({
    width: 1380, height: 850, show: true,
    title: 'ProQuote — Screenshot Harvest',
    backgroundColor: '#060b14', autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false,
    },
  });
  win.setMenuBarVisibility(false);
  const wc = win.webContents;

  const load = () => wc.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  const js = (code) => wc.executeJavaScript(code, true).catch((e) => { console.error('[shoot] js err:', e.message); return null; });

  async function captureLoop(suffix) {
    for (const sec of SECTIONS) {
      await js(`(function(){try{go('${sec}');var mc=document.getElementById('MC');if(mc)mc.scrollTop=0;var lg=document.getElementById('loginScreen');if(lg)lg.style.display='none';var lk=document.getElementById('licLock');if(lk)lk.style.display='none';}catch(e){}return true})()`);
      await sleep(RENDER_WAIT);
      const img = await wc.capturePage();
      const file = path.join(OUT_DIR, `sec-${sec}${suffix}.png`);
      fs.writeFileSync(file, img.toPNG());
      console.log('[shoot] ✓', path.basename(file), (img.getSize().width + 'x' + img.getSize().height));
    }
  }

  // ---------- الجولة العربية ----------
  await load();
  await sleep(BOOT_WAIT);
  // زرع البيانات التجريبية ثم إعادة التحميل ليعاد الإقلاع عليها
  const data = buildDemoData();
  const entries = Object.entries(data).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join('\n');
  await js(`(function(){try{localStorage.clear()}catch(e){}\n${entries}\nreturn true})()`);
  await load();
  await sleep(BOOT_WAIT);
  await js(`(function(){var lg=document.getElementById('loginScreen');if(lg)lg.style.display='none';return true})()`);
  await captureLoop('');
  console.log('[shoot] اكتملت الجولة العربية (' + SECTIONS.length + ' صورة)');

  // ---------- الجولة الإنجليزية ----------
  await js(`(function(){try{var s=JSON.parse(localStorage.getItem('pq5_s')||'{}');s.lang='en';localStorage.setItem('pq5_s',JSON.stringify(s))}catch(e){}return true})()`);
  await load();
  await sleep(BOOT_WAIT + 1000); // مهلة إضافية لقاموس الترجمة
  await js(`(function(){var lg=document.getElementById('loginScreen');if(lg)lg.style.display='none';return true})()`);
  await captureLoop('-en');
  console.log('[shoot] اكتملت الجولة الإنجليزية — اكتمل كل شيء ✓');

  app.exit(0);
}

module.exports = { isolateUserData, run, SECTIONS };
