// ============================================================
// ProQuote — محرك الترجمة (i18n)
// يدعم: العربية (ar) + الإنجليزية (en) + الفرنسية (fr)
// التحميل التزامني عبر <script> (ملفات JS بدلاً من fetch لتفادي CORS في file://)
// ============================================================

// كل ملف لغة يُحمّل ويُسجّل في window.__I18N_MESSAGES
window.__I18N_MESSAGES = window.__I18N_MESSAGES || {};

let _lang = 'ar';
let _messages = {};
let _ready = false;

// تسجيل رسائل لغة (تُستدعى من ملفات اللغات)
function registerLang(lang, messages) {
  window.__I18N_MESSAGES[lang] = messages;
  // إن كانت اللغة الحالية، حدّث المخزن المؤقت
  if (lang === _lang) _messages = messages;
}

// ضبط اللغة الحالية وتحميل رسائلها
function setLang(lang) {
  if (!window.__I18N_MESSAGES[lang]) {
    console.warn('[i18n] اللغة غير متاحة:', lang, '— الرجوع للعربية');
    lang = 'ar';
  }
  _lang = lang;
  _messages = window.__I18N_MESSAGES[lang] || {};
  _ready = true;
}

// دالة الترجمة الرئيسية: t('nav.quotes') أو t('license.daysLeft', {n: 14})
function t(key, vars) {
  if (!_messages || typeof key !== 'string') return key || '';
  // دعم النقاط: 'nav.quotes' → messages.nav.quotes
  const parts = key.split('.');
  let val = _messages;
  for (const p of parts) {
    if (val == null) break;
    val = val[p];
  }
  if (typeof val !== 'string') {
    // fallback: جرّب العربية إن كانت مختلفة
    if (_lang !== 'ar' && window.__I18N_MESSAGES.ar) {
      let fb = window.__I18N_MESSAGES.ar;
      for (const p of parts) { if (fb == null) break; fb = fb[p]; }
      if (typeof fb === 'string') val = fb;
    }
    if (typeof val !== 'string') return key;  // إرجاع المفتاح كآخر حل
  }
  // استبدال المتغيرات {name}
  if (vars && typeof vars === 'object') {
    val = val.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
  }
  return val;
}

// هل اللغة الحالية RTL؟
function isRTL() { return _lang === 'ar'; }

// اللغة الحالية
function getLang() { return _lang; }

// تطبيق اللغة على كامل الواجهة
// redrawFn: دالة إعادة بناء المحتوى الديناميكي (عادة: () => go(currentPage))
let _redrawFn = null;
function setRedrawFn(fn) { _redrawFn = fn; }

// ===== طبقة الترجمة القاموسية (ثنائية الاتجاه) =====
function _trDict() {
  const d = (window.__I18N_DICT && window.__I18N_DICT[_lang]) || null;
  if (!window.__I18N_DICT.__rev) {
    const rev = {};
    Object.keys(window.__I18N_DICT.en || {}).forEach(function (k) { rev[window.__I18N_DICT.en[k]] = k; });
    window.__I18N_DICT.__rev = rev;
  }
  if (_lang === "ar") return (window.__I18N_DICT.__rev || null);
  return d;
}
function translatePass(root) {
  if (!root) return;
  const dict = _trDict();
  if (!dict) return;
  try {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
      if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const p = n.parentNode; if (!p) return NodeFilter.FILTER_REJECT;
      const tn = p.nodeName;
      if (tn === "SCRIPT" || tn === "STYLE" || tn === "TEXTAREA") return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT; } });
    let n;
    while ((n = walker.nextNode())) {
      const raw = n.nodeValue; const t = raw.trim(); if (!t) continue;
      const tr = dict[t];
      if (tr) n.nodeValue = raw.replace(t, tr);
    }
    if (root.querySelectorAll) {
      root.querySelectorAll("input[placeholder],textarea[placeholder]").forEach(function (el) {
        const t = (el.getAttribute("placeholder") || "").trim(); const tr = dict[t];
        if (tr) el.setAttribute("placeholder", tr);
      });
      root.querySelectorAll("[title]").forEach(function (el) {
        const t = (el.getAttribute("title") || "").trim(); const tr = dict[t];
        if (tr) el.setAttribute("title", tr);
      });
    }
  } catch (e) { console.warn("[i18n] translatePass:", e); }
}
let _trObs = null, _trDeb = null;
function _trObserve() {
  if (_trObs || typeof MutationObserver === "undefined") return;
  _trObs = new MutationObserver(function () {
    clearTimeout(_trDeb);
    _trDeb = setTimeout(function () { try { translatePass(document.body); } catch (e) {} }, 60);
  });
  _trObs.observe(document.body, { childList: true, subtree: true });
}
window.translatePass = translatePass;

function applyLang(lang) {
  setLang(lang);

  // 1. سمتا <html>
  document.documentElement.lang = lang;
  document.documentElement.dir = isRTL() ? 'rtl' : 'ltr';
  // فئة الجسم لتبديل CSS
  document.body.classList.toggle('dir-ltr', !isRTL());
  document.body.classList.toggle('dir-rtl', isRTL());

  // 2. العناصر [data-i18n] (textContent)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });

  // 3. العناصر [data-i18n-ph] (placeholder)
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-ph'));
  });

  // 4. العناصر [data-i18n-title] (title attribute)
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.getAttribute('data-i18n-title'));
  });

  // 5. العناصر [data-i18n-html] (innerHTML — للنصوص بحروح HTML)
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.getAttribute('data-i18n-html'));
  });

  // 6. حفظ اللغة في الإعدادات
  try {
    const s = JSON.parse(localStorage.getItem('pq5_s') || '{}');
    s.lang = lang;
    localStorage.setItem('pq5_s', JSON.stringify(s));
    // مزامنة مع ملف البيانات الدائم إن توفّر الجسر
    if (window.proquote && window.proquote.storage) {
      window.proquote.storage.setItem('pq5_s', JSON.stringify(s)).catch(()=>{});
    }
  } catch (e) { console.warn('[i18n] فشل حفظ اللغة:', e); }


// ===== طبقة الترجمة القاموسية (تُطبق على النصوص المرسومة ديناميكياً) =====


  try { _trObserve(); translatePass(document.body); } catch (e) {}
  // 7. إعادة بناء المحتوى الديناميكي
  if (typeof _redrawFn === 'function') {
    try { _redrawFn(); } catch (e) { console.error('[i18n] redraw error:', e); }
    try { translatePass(document.body); } catch (e) {}
  }
}

// قراءة اللغة المحفوظة أو الكشف عن لغة النظام
function detectLang() {
  try {
    const s = JSON.parse(localStorage.getItem('pq5_s') || '{}');
    if (s.lang && window.__I18N_MESSAGES[s.lang]) return s.lang;
  } catch {}
  // كشف من لغة النظام
  const nav = (navigator.language || 'ar').toLowerCase();
  if (nav.startsWith('fr')) return 'fr';
  if (nav.startsWith('en')) return 'en';
  return 'ar';
}

// كشف لغة التسطيب (من ملف lang.txt الذي يكتبه NSIS)
async function detectInstallLang() {
  try {
    if (window.proquote && window.proquote.installLang) {
      const lang = await window.proquote.installLang();
      if (lang && window.__I18N_MESSAGES[lang]) return lang;
    }
  } catch {}
  return null;
}

// التهيئة الأولية: حمّل اللغة المحفوظة/المكتشفة ثم طبّقها
async function initI18n(redrawFn) {
  if (typeof redrawFn === 'function') setRedrawFn(redrawFn);
  // الأولوية: لغة محفوظة > لغة التسطيب > لغة النظام > عربي
  let lang = detectLang();
  if (lang === 'ar' || !localStorage.getItem('pq5_s')) {
    const installLang = await detectInstallLang();
    if (installLang) lang = installLang;
  }
  setLang(lang);
  // طبّق الاتجاه فوراً قبل الرسم (لتفادي الوميض)
  document.documentElement.lang = lang;
  document.documentElement.dir = isRTL() ? 'rtl' : 'ltr';
}

// تصدير الدوال للاستخدام العام
window.t = t;
window.isRTL = isRTL;
window.getLang = getLang;
window.applyLang = applyLang;
window.initI18n = initI18n;
window.registerLang = registerLang;
window.setRedrawFn = setRedrawFn;
