// ============================================================
// ProQuote — قاموس الترجمة المباشر (عربي ← إنجليزي)
// توسعة 8.2.0 — تغطية الإعدادات والأعمدة والقوالب والفواتير
// ============================================================
window.__I18N_DICT = window.__I18N_DICT || {};
window.__I18N_DICT.en = Object.assign(window.__I18N_DICT.en || {}, {
// ===== تبويبات الإعدادات =====
'الشركة':'Company','الشروط':'Terms','المستندات':'Documents','القوالب':'Templates','عام':'General','المزامنة':'Sync','حول':'About',
'بيانات الشركة':'Company Information','شعار الشركة':'Company Logo','اضغط لرفع الشعار':'Click to upload logo',
'حجم الشعار':'Logo size','صغير 40px':'Small 40px','متوسط 60px':'Medium 60px','كبير 80px':'Large 80px','كبير جداً 110px':'X-Large 110px','خخم 140px':'Huge 140px',
'محاذاة الشعار':'Logo alignment','يمين':'Right','يسار':'Left','تخطيط الشعار (الصف الواحد)':'Logo layout (single row)',
'اسم الشركة':'Company name','الرقم الضريبي':'Tax number','الهاتف':'Phone','البريد الإلكتروني':'Email','العنوان':'Address','الموقع الإلكتروني':'Website',
'العملة الافتراضية':'Default currency','ريال سعودي (ر.س)':'Saudi Riyal (SAR)','درهم إماراتي (د.إ)':'UAE Dirham (AED)','جنيه مصري (ج.م)':'Egyptian Pound (EGP)','دولار أمريكي ($)':'US Dollar ($)','يورو (€)':'Euro (€)',
'الضريبة %':'VAT %','نسبة الضريبة':'VAT rate','إعدادات العروض':'Quote settings','حفظ':'Save','حفظ الإعدادات':'Save settings',
'معلومات التسطيب':'Installation info','رقم الإصدار':'Version','معلومات النظام':'System info','مسار البيانات':'Data path',
// ===== تسميات أعمدة كل الأقسام =====
'الكود':'Code','QR':'QR','صورة':'Image','السعر والإجمالي':'Price & Total','إجمالي الكميات':'Total Quantities','السعر':'Price','العمود':'Column',
'إضافة عمود إضافي':'Add extra column','اسم العمود':'Column name','مثال: اللون، الحجم، الملاحظات...':'e.g. Color, Size, Notes...',
'عمود رقم (يُحسب ضمن الإجمالي)':'Numeric column (included in total)','عمود رقم (يُحسب ضمن التكلفة)':'Numeric column (included in cost)',
'عمود رقم (يُحدد الكمية — مجموع الأعمدة هو الكمية النهائية)':'Numeric column (sets quantity — sum of columns is final qty)',
'كود المنتج':'Product code','الوصف':'Description','الكمية':'Quantity','الوحدة':'Unit','المقاس':'Size','اللون':'Color','النوع':'Type',
'تكلفة التصنيع':'Manufacturing cost','تطريز':'Embroidery','طباعة':'Printing','اكسسوارات':'Accessories','تكلفة القطعة':'Unit cost','الإجمالي':'Total',
'رقم أمر التشغيل':'WO number','حالة التصنيع':'Mfg. status','المصنع':'Factory','المصنع المسند إليه':'Assigned factory',
'رقم الشحنة':'Shipment no.','عدد التوبات':'Number of rolls','الصنف / الخامة':'Item / Material','الأصناف':'Items',
// ===== إعدادات القوالب والألوان =====
'اختيار القالب':'Template selection','ألوان مخصصة':'Custom colors','تفعيل ألوان مخصصة':'Enable custom colors','لون عنوان الشركة':'Company title color','لون نصوص الجدول':'Table text color','لون رأس الجدول':'Table header color',
'كلاسيكي':'Classic','فاخر':'Elegant','عصري':'Modern','بسيط':'Simple','دافئ':'Warm','مؤسسي':'Corporate','إبداعي':'Creative','رسمي':'Formal',
'Modern عصري':'Modern','Corporate هندسي':'Corporate','Minimal بسيط':'Minimal','مساحات بيضاء — لون مميز موحد':'White spaces — unified accent color','شريط متدرج بزاوية مائلة — للشركات':'Gradient strip with angled cut — corporate','حدود سوداء رفيعة — اقتصادي حبر':'Thin black borders — ink saving',
'الخط المخصص':'Custom font','حجم العنوان':'Heading size','حجم النص':'Body size','موضع عنوان المستند':'Document title position','أعلى يسار':'Top left','أعلى يمين':'Top right','وسط':'Center','يمين':'Right',
// ===== إعدادات عامة =====
'بادئة عرض السعر':'Quote prefix','نص إذن الاستلام':'Receipt permit text','نص أمر التوريد':'Supply order text','نص عرض فني':'Technical offer text','نص العينة':'Sample text',
'الأعمدة الإضافية الافتراضية (مفصولة بفاصلة)':'Default extra columns (comma separated)','أعمدة مدخلات/مخرجات المخزن الافتراضية (مفصولة بفاصلة)':'Default warehouse IO columns (comma separated)',
'تفعيل الشروط والأحكام':'Enable terms & conditions','تخطيط الشروط':'Terms layout','عمودين':'Two columns','صف واحد':'Single row',
'إظهار شارة الحالة':'Show status badge','حذف الكل':'Delete all','تنبيه انتهاء الصلاحية':'Expiry alert (days)','كلمة الشحن (في العرض)':'Shipping label (in quote)',
'عرض الأسعار المتأثرة':'Affected quotes','تحديث المستندات الحالية':'Update current documents',
// ===== المزامنة =====
'اسم هذا الجهاز (يظهر للآخرين)':'This device name (shown to others)','إنشاء رابط':'Create link','لديّ كود من جهاز آخر':'I have a code from another device','الأجهزة':'Devices',
'رابط مشروع Supabase':'Supabase project URL','Anon Key (العام)':'Anon Key (public)','اسم هذا الجهاز بالسحابة':'Cloud device name',
'رابط خادم التحديثات (اختياري — GitHub Releases)':'Update server URL (optional — GitHub Releases)','تشغيل المزامنة السحابية':'Enable cloud sync','حفظ وتشغيل':'Save & start','مزامنة الآن':'Sync now',
'متزامن ✓':'Synced ✓','جارٍ الاتصال…':'Connecting…','تعذّر الاتصال بالسحابة — أوفلاين':'Cloud unreachable — offline','أوفلاين — البيانات محفوظة محلياً':'Offline — data saved locally',
// ===== الفاتورة الإلكترونية =====
'فواتير ضريبية إلكترونية':'Electronic tax invoices','ربط الضرائب':'Tax authority connection','فاتورة جديدة':'New invoice','نوع المستند':'Document type','نوع المستلم':'Receiver type',
'منشأة (B)':'Business (B)','فرد (P)':'Individual (P)','اسم المستلم':'Receiver name','الرقم الضريبي للمستلم':'Receiver tax number','عنوان المستلم (بلد/محافظة/مدينة)':'Receiver address (country/gov/city)',
'إنشاء من':'Create from','يدوي':'Manual','كود GPC/EGS':'GPC/EGS code','قيمة الضريبة':'Tax amount','رقم الإرسال':'Submission No.',
'البيئة':'Environment','تجريبية (Pre-production)':'Pre-production','إنتاجية (Production)':'Production','كود النشاط الضريبي':'Tax activity code',
'أنواع الضرائب':'Tax types','إضافة نوع ضريبة':'Add tax type','الدولة':'Country','النوع الرئيسي':'Main type','النوع الفرعي':'Sub-type','النسبة':'Rate',
'ضريبة القيمة المضافة 14%':'VAT 14%','قيمة مضافة 0% (تصدير)':'VAT 0% (export)','خصم وإضافة — توريدات 1%':'Withholding — supplies 1%','خصم وإضافة — خدمات 3%':'Withholding — services 3%',
'مسار أداة التوقيع (EInvoicingSigner.exe) — اختياري':'Signer tool path (optional)','إرسال للضرائب':'Send to ETA','مقبولة':'Accepted','مرفوضة':'Rejected','مُرسلة':'Submitted',
// ===== الاشتراكات =====
'الباقات الشهرية والسنوية':'Monthly & yearly plans','الباقة الفردية الشهرية':'Individual monthly','فعّل نسختك أو ادفع عبر PayPal':'Activate your copy or pay via PayPal','الأسعار':'Prices','تحكم أسعار الباقات وروابط PayPal':'Plan prices & PayPal links control',
'فرد':'Individual','شركات صغيرة':'Small business','شركات متوسطة':'Medium business','غير محدود':'Unlimited','شهري':'Monthly','سنوي':'Yearly','اشترك عبر PayPal':'Subscribe via PayPal','اطلب التفعيل من الدعم':'Request activation from support',
'لديّ كود تفعيل':'I have an activation code','ألصق كود التفعيل الذي وصلك بالبريد بعد الدفع':'Paste the activation code you received by email after payment',
// ===== الإدارة =====
'مستخدم جديد':'New user','اسم المستخدم الظاهر':'Display name','تأكيد الرمز':'Confirm PIN','حساب نشط':'Active account','ربط بموظف مسجل (اختياري)':'Link to registered employee (optional)',
'مصفوفة صلاحيات الأقسام':'Section permission matrix','بدون':'None','مشاهدة':'View only','تعديل':'Edit',
'مسؤول — كل الصلاحيات + الإدارة':'Manager — full access + admin','مشرف — تعديل الكل عدا الإدارة والإعدادات':'Supervisor — edit all except admin/settings','موظف — مشاهد + تعديل المحدد':'Employee — view + edit allowed',
// ===== تصنيع =====
'أماكن التصنيع':'Manufacturing locations','مصنع واحد':'Single factory','أكثر من مصنع':'Multiple factories','مصانع التوزيع':'Distribution factories',
'توزيع بنود أمر التوريد':'Distribute supply order items','تعبئة البنود المتبقية':'Fill remaining items','المتبقي للتوزيع':'Remaining to distribute','مكتملة التوزيع لمصانع التشغيل':'Fully distributed to manufacturing factories',
'أضف المصنع التالي':'Add next factory','المطلوب':'Required','الموزَّع على أوامر تشغيل أخرى':'Distributed to other WOs','متبقٍ':'Remaining',
// ===== مدخلات/مخرجات =====
'مدخل — استلام من التصنيع':'Input — receive from manufacturing','مخرج — تسليم للعميل':'Output — deliver to customer',
'ربط بأمر تشغيل (للمدخلات)':'Link to work order (inputs)','ربط بأمر توريد':'Link to supply order','حالة المدخل':'Input status','حالة بنود أمر التوريد':'Supply order items status',
'الأعداد المستلمة بالمخزن لهذه الجهة':'Quantities received in warehouse for this party','المتاح للشحن من المدخلات':'Available to ship from inputs',
// ===== مناقصات =====
'آخر موعد للتقديم':'Submission deadline','فتح المظاريف':'Envelope opening','التأمين الابتدائي':'Initial guarantee','التأمين النهائي':'Final guarantee','تكلفة كراسة الشروط':'Tender document cost',
'جميع الكميات موزعة بالفعل — لا توجد أعداد إضافية لتوزيعها على مصانع أخرى':'All quantities already distributed — no additional quantities for other factories',
'انقضى موعد التقديم':'Submission deadline passed','باقي':'Remaining','خطر المصادرة!':'Forfeiture risk!',
'ينتهي خلال':'Expires within','انتهى بتاريخ':'Expired on','تم البت':'Decision made','قيد التحضير للشحن':'Preparing for shipment','تم الاسترداد':'Recovered',
// ===== عناصر متنوعة =====
'لوحة التحكم':'Dashboard','آخر التحديثات':'Recent updates','تنبيه':'Alert','تنبيهات':'Alerts','مرحباً':'Welcome','جارٍ التحميل...':'Loading...',
'تم':'Done','جارٍ...':'Working...','نعم':'Yes','لا':'No','موافق':'OK','إلغاء':'Cancel','تأكيد':'Confirm','تحذير':'Warning','خطأ':'Error','نجاح':'Success',
'انقر للتفعيل':'Click to activate','جارٍ الفحص…':'Checking…','مفعل':'Activated','تجريبي':'Trial','منتهي':'Expired','متبقي':'Remaining',
'الملف الشخصي':'Profile','تسجيل الخروج':'Sign out','الإعدادات العامة':'General Settings','إدارة النظام':'System Management',
'النسخ الاحتياطي':'Backup','استعادة':'Restore','تصدير':'Export','استيراد':'Import','تنزيل':'Download','رفع':'Upload',
'تاريخ الإنشاء':'Created','آخر تعديل':'Last modified','بواسطة':'By','الحالة العامة':'Overall status','خالص':'Settled','مستمر':'Ongoing',
'توقيع':'Signature','التوقيع':'Signature','ملاحظات':'Notes','ملاحظة':'Note','إضافة ملاحظة':'Add note','عرض الكل':'View all','إظهار المزيد':'Show more','إخفاء':'Hide',
'الفاتورة الضريبية الإلكترونية':'Electronic Tax Invoice','فقط':'only','لا غير':'only','إجباري':'Mandatory','اختياري':'Optional',
// ===== رمز الإقران السريع (9.4.1) =====
'رمز الإقران السريع':'Quick Pairing Code','إقران سريع مع جهاز المسئول':'Quick pair with admin device','الصق رمز الإقران هنا (يبدأ بـ PQP1:)':'Paste pairing code here (starts with PQP1:)',
'تفعيل الإقران وجلب المستخدمين':'Activate pairing & fetch users','إقران':'Pair','رمز إقران غير صالح — تأكد من نسخه كاملاً':'Invalid pairing code — make sure you copied it fully','رمز إقران غير مكتمل':'Incomplete pairing code',
'تم الإقران بنجاح':'Pairing completed','تم الإقران — جارٍ جلب المستخدمين...':'Paired — fetching users...','رمز إقران الموظفين':'Employee pairing code','تم نسخ رمز الإقران — أرسله للموظف':'Pairing code copied — send it to the employee',
'أدخل رابط Supabase والمفتاح العام أولاً':'Enter the Supabase URL and anon key first','تم الإقران — فُعّلت المزامنة السحابية':'Paired — cloud sync enabled','لصق رمز الإقران من المسئول (PQP1:...)':'Paste pairing code from admin (PQP1:...)','مهيأة بالإقران ✓':'Paired & ready ✓','انسخ الرمز يدوياً من الصندوق':'Copy the code manually from the box',
'أرسل هذا الرمز للموظف عبر تلجرام/واتساب/البريد. عند الموظف: من شاشة الدخول اضغط «إقران سريع مع جهاز المسئول» ثم الصق الرمز واضغط تفعيل — ستُجلب حسابات المستخدمين والصلاحيات تلقائياً.':'Send this code to the employee (Telegram/WhatsApp/email). On the employee side: from the login screen tap "Quick pair with admin device", paste the code and activate — user accounts and permissions are fetched automatically.',
'الرمز يحتوي رابط مشروع Supabase والمفتاح العام فقط — بياناتك محمية بقواعد RLS، ويمكن للمسئول إيقاف الوصول من لوحة Supabase في أي وقت.':'The code contains only the Supabase project URL and public anon key — your data is protected by RLS rules, and the admin can revoke access from the Supabase dashboard at any time.'
,
// ===== الاشتراكات PayPal (البند B) =====
'حتى 1 مستخدم':'Up to 1 user','حتى 3 مستخدم':'Up to 3 users','حتى 8 مستخدم':'Up to 8 users','مستخدمون بلا حدود':'Unlimited users','شهرياً':'Monthly','سنوياً':'Yearly','شهري':'Monthly','سنوي':'Yearly','الأكثر طلباً':'Most popular','اشترك عبر PayPal':'Subscribe via PayPal',
'لديّ كود تفعيل':'I have an activation code','ألصق كود التفعيل الذي وصلك بالبريد بعد الدفع':'Paste the activation code emailed to you after payment','تفعيل':'Activate','تم التفعيل بنجاح 🎉':'Activated successfully 🎉','ألصق كود التفعيل أولاً':'Paste the activation code first','كود غير صالح':'Invalid code','تعذر التفعيل: ':'Activation failed: ',
'فرد':'Individual','شركات صغيرة':'Small Businesses','شركات متوسطة':'Medium-sized Companies','غير محدود':'Unlimited','الباقات الشهرية والسنوية — فعّل نسختك أو ادفع عبر PayPal':'Monthly & yearly plans — activate your copy or pay via PayPal'
,
// ===== البند C: خادم مخصص + شرح المزامنة =====
'مزامنة عبر خادم مخصص — أي هوست (بديل Supabase)':'Custom server sync — any host (Supabase alternative)','رابط الخادم (Supabase أو خادم مخصص)':'Server URL (Supabase or custom)','المفتاح (Anon Key أو مفتاح الخادم API Key)':'Key (Anon Key or server API Key)','اختبار الاتصال بالسحابة':'Test cloud connection','يعمل مع Supabase والخادم المخصص معاً':'Works with both Supabase and custom server','الاتصال بالسحابة ناجح ✓':'Cloud connection successful ✓','فشل الاتصال — HTTP ':'Connection failed — HTTP ','تعذر الاتصال بالخادم — تأكد من الرابط والتشغيل':'Cannot reach server — check URL and that it is running','أدخل رابط الخادم والمفتاح في «المزامنة السحابية» أولاً':'Enter the server URL and key in Cloud Sync first','جارٍ اختبار الاتصال…':'Testing connection…','الاتصال ناجح ✓':'Connection OK ✓','فشل: HTTP ':'Failed: HTTP ','تعذر الاتصال':'Cannot connect','المزامنة السحابية — الشرح الكامل':'Cloud Sync — Full Guide','خطوات التشغيل:':'Setup steps:','الدليل الكامل خطوة بخطوة بالصور: ملف ':'Full step-by-step illustrated guide: file '
,
// ===== البند D: الأمضاء =====
'أمضاء':'Signature','أمضاء المسؤول':'Authorized Signature','ختم الشركة والأمضاء':'Company Stamp & Signature','حذف الأمضاء':'Remove signature','اضغط لرفع صورة الأمضاء':'Click to upload the signature image','جارٍ معالجة الأمضاء...':'Processing signature...','تم حذف الأمضاء':'Signature removed','تم رفع الأمضاء وإزالة الخلفية':'Signature uploaded & background removed','يتم إزالة الخلفية تلقائياً':'Background is removed automatically'
});
