# دليل رفع ProQuote على GitHub — خطوة بخطوة (آمن 100%)

> ✅ **لماذا الرفع آمن الآن**: بعد تحول الترخيص لنظام المفتاح العام (RSA-2048)، البرنامج يحمل **المفتاح العام فقط** — فحصه يكشف صفر أسرار. حتى لو نُشر الكود كاملاً، لا يمكن لأحد توليد ترخيص مزوّر (المفتاح الخاص يسكن Supabase فقط).
> 🔒 `.gitignore` يحمي تلقائياً: `admin-panel.html` (لوحة المطور بكلمة المرور) • `dist/` • `_keypair.json` وكل الملفات المؤقتة `_*.js/_*.json` • `node_modules` • `sync-data.json`.

---

## ١) إنشاء المستودع

1. github.com ← زر **+** أعلى اليمين ← **New repository**
2. الاسم: `proquote` — الوصف: نظام إدارة عروض الأسعار والمستندات
3. **Private أو Public — كلاهما آمن الآن** (اختر Private إن أردت كوداً غير مرئي، أو Public لثقة أكبر)
4. بلا README مبدئي (عندنا واحد) ← **Create repository**

## ٢) الرفع من جهازك (مرة واحدة)

```bat
cd "D:\works\price list\saved price list\price list program\proquote-electron"
git init
git add .
git commit -m "ProQuote 9.7.0 — public-key licensing, PayPal automation, focus permissions, Telegram share, full EN translation"
git branch -M main
git remote add origin https://github.com/javamicrosystem2-gif/proquote.git
git push -u origin main
```
> إن طلب تسجيل الدخول: استخدم **Personal Access Token** (Settings ← Developer settings ← Tokens) بدل كلمة المرور.

## ٣) تحقق الأمان بعد الرفع (دقيقتان)

افتح المستودع على GitHub وتأكد **عدم** وجود:
- `admin-panel.html` ✗
- أي ملف يبدأ بـ `_` (مثل `_keypair.json`) ✗
- مجلد `dist/` أو `node_modules/` ✗
وأن `src/main/license.js` موجوداً بالمفتاح **العام** فقط ✓

## ٤) إصدار التحديثات (يصل للمشتركين تلقائياً)

1. المستودع ← **Releases ← Draft new release**
2. Choose a tag ← أكتب `v9.7.0` ← Create new tag
3. العنوان: `ProQuote 9.7.0` — وصف موجز بالتغييرات
4. **Attach binaries** ← ارفع `dist\ProQuote-Setup-9.7.0.exe`
5. **Publish release**
6. حدّث زر «تحميل المثبّت» في `landing/index.html` بالرابط:
   `https://github.com/javamicrosystem2-gif/proquote/releases/latest/download/ProQuote-Setup-latest.exe`
   (أو الرابط المباشر للإصدار) — ثم أعد رفع `web-dist` على Cloudflare.

## ٥) تحديثات لاحقة (روتين ثابت)

```bat
git add .
git commit -m "9.7.1 — وصف التحديث"
git push
:: ثم Release جديد بالمثبِّت الجديد (الخطوة ٤)
```

## ٦) مستودع نشر عام منفصل (إن اخترت كوداً خاصاً)

إن جعلت `proquote` خاصاً وأنشأت `proquote-release` عاماً للتحميلات فقط:
- زر التحميل في الهبوط يشير إلى `github.com/javamicrosystem2-gif/proquote-release/releases/...`
- والتحديث التلقائي في إعدادات المشتركين: `https://github.com/javamicrosystem2-gif/proquote-release/releases/latest/download/`
