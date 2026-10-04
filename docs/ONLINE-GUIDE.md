# دليل العمل أونلاين — ProQuote 8.0

## 1) المزامنة السحابية (Supabase) — مجاني
نفس خطوات الإصدار السابق: أنشئ مشروعاً مجانياً على supabase.com، نفّذ `supabase.sql`، وألصق الرابط وanon key في **الإعدادات ← المزامنة**.

> ℹ️ ملاحظة (الخطة المجانية): المشروع يتوقف مؤقتاً بعد أسبوع كامل من عدم النشاط — الاستخدام المنتظم للبرنامج يُبقيه نشطاً، وإن توقف فأعد فتحه بضغطة واحدة من لوحة supabase.com.

## 2) خطط الاشتراك السحابية (اختياري)
نفّذ `supabase-plans.sql` بمشروعك نفسه — ثم يقرأ البرنامج أسعار الباقات من السحابة إن كانت مهيأة، وإلا يستخدم الأسعار المحلية (قسم الاشتراكات ← زر «الأسعار» للمسؤول).

## 3) التفعيل التلقائي بعد الدفع (PayPal ← بريد) — نظام المفتاح العام
المعمارية: البرنامج يحمل المفتاح العام فقط — التوليد والربط يتمان على السيرفر.

1. أنشئ خطط PayPal Subscriptions (Developer PayPal ← Products & Plans) — معرفات الخطط الثمانية مضمّنة في الدالة.
2. انشر الدالتين على Supabase:
   ```
   supabase functions deploy activate-license --no-verify-jwt
   supabase functions deploy distribute-license --no-verify-jwt
   ```
3. أسرار Edge Functions (Supabase ← Edge Functions ← Secrets):
   - LICENSE_SIGNING_KEY = المفتاح الخاص RSA (PEM) — لا يغادر السيرفر أبداً
   - PAYPAL_CLIENT_ID / PAYPAL_SECRET = من developer.paypal.com
   - PAYPAL_WEBHOOK_ID = معرف الويبهوك، PAYPAL_ENV = live أو sandbox
   - RESEND_API_KEY = من resend.com، MAIL_FROM = ProQuote <onboarding@resend.dev>
4. عدّل LICENSE_SERVER في src/main/license.js ليصبح: https://<project>.supabase.co/functions/v1/activate-license
5. في PayPal ← Webhooks أضف: https://<project>.supabase.co/functions/v1/distribute-license
   بالأحداث: BILLING.SUBSCRIPTION.ACTIVATED و RENEWED و CANCELLED/EXPIRED.
6. التدفق: يدفع المشترك ← يصله الكود بالبريد فوراً ← يفعّل داخل البرنامج (يُربط بجهازه) — والتجديد الشهري يمتد تلقائياً.
7. للبيع اليدوي: admin-panel ← «توليد كود تفعيل» (كود عام يُخزن unused ويرتبط بالجهاز عند أول تفعيل).

## 4) نسخة الويب (Cloudflare Pages — مجاني للأبد) + موقعك على Blogspot

> **الأساسي**: Cloudflare Pages (راجع docs/CLOUDFLARE-PAGES.md) — مجاني بلا بطاقة وبلا صيانة.
> **بديل ذاتي**: سيرفرك عبر aaPanel (راجع docs/AAPANEL-GUIDE.md) — لمن يملك سيرفراً.
- **aaPanel (سيرفرك)**: ثبّت aaPanel على سيرفر Ubuntu، ثم: Website ← Add Site ← ارفع محتويات مجلد `web-dist` (ملفات ثابتة فقط — لا يحتاج Node). نسخة الويب نفسها لا تحتاج أي خادم خلفي: مزامنتها عبر Supabase مباشرة من المتصفح.
- **Blogspot (موقعك proquote-amrnada.blogspot.com)**: من لوحة Blogger ← صفحة جديدة ← وضع HTML ← ألصق محتوى `landing/index.html` كاملاً ← نشر. تحصل على صفحة اشتراك وتحميل احترافية على رابط موقعك مباشرة.
- عدّل قبل النشر: رابط تلجرام (t.me/javamicro) وروابط التحميل الثلاثة (نسخة الكمبيوتر من GitHub Releases، نسخة الويب من رابط سيرفرك).

## 5) التحديثات التلقائية (GitHub)
كما في الدليل السابق: ضع في الإعدادات ← المزامنة ← رابط خادم التحديثات:
`https://github.com/USERNAME/REPO/releases/latest/download/`

## 6) الفاتورة الإلكترونية المصرية (ETA)
1. **إعدادات الربط** (قسم الفاتورة الإلكترونية ← «ربط الضرائب»):
   - البيئة: تجريبية (Pre-production) للتجربة، ثم إنتاجية عند الجدية
   - كود النشاط الضريبي لنشاط شركتك، Client ID و Client Secret من بوابة الممول (eta.gov.eg ← e-Invoicing)
2. **التوقيع الإلكتروني**: منظومة الضرائب تشترط توقيع CAdES-BES من فلاشة التوقيع (Token):
   - جهّز أداة توقيع خارجية (مثال: EInvoicingSigner.exe من مزود الفلاشة — Egypt Trust / مصر للمقاصة، أو أداة C# بسيطة تستخدم pkcs11)
   - ضع مسارها في «مسار أداة التوقيع» — البرنامج يمرر JSON الفاتورة للملف ويقرأ التوقيع من المخرجات
   - بدون الأداة: تُحفظ الفاتورة محلياً بتوقيع مؤقت وتُوسم «غير مُقدمة» — يمكنك الطباعة والمعاينة بلا إرسال
3. **الإرسال**: زر ✈ بجوار كل فاتورة — يجلب Access Token ثم يوقّع ثم يرسل إلى documentsubmissions ويعرض رقم الإرسال (submissionId) وحالة القبول/الرفض مع تفاصيل الأخطاء للتصحيح.
4. **الضرائب الديناميكية**: بذور مصرية جاهزة (T1-V009 14%، T4-W002/W004) — أضف أي ضريبة عالمية (دولة/كود/نسبة) من نفس النافذة.
5. **الحساب**: قيم الضريبة بخمس خانات عشرية كما تشترط المنظومة، وtaxTotals مجمعة حسب النوع (T1، T4…).

## 7) مواعيد النشر على الحسابات الثلاثة
| الخدمة | الاستخدام | التكلفة |
|---|---|---|
| supabase.com | مزامنة + خطط + تفعيل بريدي تلقائي | مجاني |
| proquote-amrnada.blogspot.com | صفحة الاشتراك والتحميل (الموقع الرسمي) | مجاني |
| github.com | مستودع الكود + إصدارات التحديث | مجاني |
| Cloudflare Pages | نسخة الويب | مجاني للأبد (بلا بطاقة) |

## 8) بديل Supabase — خادم مزامنة على أي هوست (ProQuote 9.4)

إن كان لديك سيرفر خاص أو استضافة لدى أي مزوّد آخر، شغّل الملف المرفق **sync-server.js** (Node.js فقط — بلا أي مكتبات) واستخدمه بدل Supabase بنفس حقول الإعدادات.

### التشغيل
```bash
API_KEY=مفتاحك-السري PORT=3000 node sync-server.js
```

- البيانات تُخزَّن في ملف `sync-data.json` بجوار السكربت (غيّر مكانه بمتغير `DATA_FILE`).
- التوافق: نفس نداءات التطبيق (`/rest/v1/pq_state` و `/rest/v1/pq_plans`) — في البرنامج ضع الرابط `http://سيرفرك:3000` والمفتاح = `API_KEY` في الإعدادات ← المزامنة السحابية.
- يعمل مع: VPS، سيرفر الشركة، Railway، Render، أي بيئة Node.js.

### الاستضافة السريعة
| المنصة | الطريقة |
|---|---|
| Railway / Render | مشروع Node.js جديد ← ارفع sync-server.js ← متغيرات البيئة API_KEY وPORT |
| VPS / سيرفر الشركة | `node sync-server.js` خلف Nginx أو مباشرة بالمنفذ |

> ملاحظة أمان: استخدم HTTPS أمام الخادم (Nginx/منصة استضافة) حتى لا يُرسل المفتاح نصاً صريحاً عبر الإنترنت.

