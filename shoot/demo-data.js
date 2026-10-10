// ============================================================
// ProQuote — بيانات تجرية نظيفة لالتقاط لقطات التسويق (--shoot)
// كل الأسماء والأسعار وهمية تماماً — لا توجد أي بيانات حقيقية هنا
// تُزرع في مجلد userData معزول (TEMP) ولا تلمس بيانات المستخدم أبداً
// ============================================================
'use strict';

const D = (offsetDays) => new Date(Date.now() - offsetDays * 86400000).toISOString().slice(0, 10);
const T = (offsetDays) => Date.now() - offsetDays * 86400000;

// صورة منتج SVG مصغّرة (data URI) — بدون ملفات خارجية
function prodImg(color, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="12" fill="${color}"/><text x="48" y="56" font-size="30" text-anchor="middle" fill="#fff" font-family="Tahoma">${label}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

const IMG = {
  p1: prodImg('#00a885', 'رول'),
  p2: prodImg('#2563eb', 'أكياس'),
  p3: prodImg('#f59e0b', 'كرتون'),
  p4: prodImg('#8b5cf6', 'شريط'),
  p5: prodImg('#ef4444', 'فوم'),
  p6: prodImg('#14b8a6', 'فقاعات'),
};

// ---------- الإعدادات (شركة وهمية) ----------
const settings = {
  companyName: 'شركة الأفق للتغليف الحديث', taxNumber: '112-345-678',
  phone: '0100 123 4567', additionalPhone: '02 2345 6789', fax: '02 2345 6700',
  email: 'info@alofoq-pack.example', website: 'www.alofoq-pack.example',
  address: 'المنطقة الصناعية — العبور، القاهرة', commercialRegister: '98765',
  currency: 'EGP', taxRate: 14, validity: 30, prefix: 'QT', template: 'classic',
  lang: 'ar', quotationText: 'QUOTATION',
  t_pay: 'يلتزم العميل بسداد المبلغ خلال 30 يوماً من تاريخ الموافقة.',
  t_del: 'يتم التوريد خلال 15-20 يوم عمل من تأكيد الطلب.',
  t_war: 'ضمان سنة من التوريد ضد عيوب الصناعة.',
  termsEnabled: true, logoInHeader: false, stampSize: 100, sigSize: 120,
  logoSize: 80, headingFont: 'Tajawal', bodyFont: 'Tajawal', headingSize: 22, bodySize: 13,
};

// ---------- العملاء ----------
const clients = [
  { id: 'c1', name: 'شركة النيل للصناعات الغذائية', code: 'C-0001', phone: '0100 111 2233', email: 'purchase@nilefood.example', address: 'مدينة السادس من أكتوبر — الجيزة', jobTitle: 'م. أحمد الشريف — مدير المشتريات', taxNumber: '204-556-771', warehouse: 'المخزن الرئيسي', location: 'https://maps.google.com/?q=29.9,31.2', payMethodType: 'bank', payMethodDetails: 'CIB — 1000 2345 6789', payMethodHolder: 'شركة النيل', at: T(2) },
  { id: 'c2', name: 'مؤسسة الدلتا للمقاولات', code: 'C-0002', phone: '0111 222 3344', address: 'المنطقة الصناعية — الإسكندرية', taxNumber: '301-445-220', payMethodType: 'instapay', payMethodDetails: 'deltasupply@instapay', at: T(5) },
  { id: 'c3', name: 'مصنع الرحاب للأدوية', code: 'C-0003', phone: '0122 333 4455', email: 'store@rehabpharma.example', address: 'برج العرب — الإسكندرية', payMethodType: 'cheque', at: T(9) },
  { id: 'c4', name: 'شركة الشرق للتجارة العامة', code: 'C-0004', phone: '0100 444 5566', address: 'وسط البلد — القاهرة', at: T(14) },
  { id: 'c5', name: 'مكتب المعمار للاستشارات الهندسية', code: 'C-0005', phone: '0114 555 6677', address: 'مدينة نصر — القاهرة', location: 'https://maps.google.com/?q=30.05,31.33', at: T(20) },
  { id: 'c6', name: 'شركة الوادي للتوريدات', code: 'C-0006', phone: '0128 666 7788', address: 'العاشر من رمضان — الشرقية', payMethodType: 'wallet', at: T(26) },
];

// ---------- المنتجات ----------
const products = [
  { id: 'p1', code: 'P-1001', name: 'رول بلاستيك شفاف 100سم × 150م', price: 1850, unit: 'رول', image: IMG.p1, url: 'PQ://P-1001', variants: [{ اللون: 'شفاف' }, { اللون: 'أبيض' }], at: T(1) },
  { id: 'p2', code: 'P-1002', name: 'أكياس تغليف 50×70 سم — سرعة تحميل 10كجم', price: 320, unit: 'ألف كيس', image: IMG.p2, url: 'PQ://P-1002', at: T(3) },
  { id: 'p3', code: 'P-1003', name: 'كرتون مضلع 3 طبقات 60×40×40', price: 24.5, unit: 'كرتونة', image: IMG.p3, url: 'PQ://P-1003', at: T(6) },
  { id: 'p4', code: 'P-1004', name: 'شريط لاصق مطبوع بشعار العميل — بعرض 5سم', price: 96, unit: 'لفة', image: IMG.p4, url: 'PQ://P-1004', at: T(8) },
  { id: 'p5', code: 'P-1005', name: 'فوم حماية للزجاج — رول 1م × 50م', price: 640, unit: 'رول', image: IMG.p5, url: 'PQ://P-1005', at: T(11) },
  { id: 'p6', code: 'P-1006', name: 'بلاستيك فقاعات هوائية 1.5م × 100م', price: 2310, unit: 'رول', image: IMG.p6, url: 'PQ://P-1006', at: T(15) },
  { id: 'p7', code: 'P-1007', name: 'ورق لف هندسي بني 90سم', price: 410, unit: 'رول', url: 'PQ://P-1007', at: T(18) },
  { id: 'p8', code: 'P-1008', name: 'أكياس زبالة صندوقية 90×120 — سوداء', price: 175, unit: 'ألف كيس', url: 'PQ://P-1008', at: T(22) },
];

// ---------- عروض الأسعار ----------
const quotes = [
  { id: 'q1', number: 'QT-2601', clientName: 'شركة النيل للصناعات الغذائية', subject: 'توريد مواد تغليف — الربع الأول', date: D(2), currency: 'EGP', total: 96400, status: 'approved', at: T(2), items: [{ name: 'رول بلاستيك شفاف 100سم', qty: 20, price: 1850 }, { name: 'أكياس تغليف 50×70', qty: 150, price: 320 }] },
  { id: 'q2', number: 'QT-2602', clientName: 'مؤسسة الدلتا للمقاولات', subject: 'عرض سعر فوم + بلاستيك فقاعات', date: D(5), currency: 'EGP', total: 52800, status: 'sent', at: T(5), items: [{ name: 'فوم حماية للزجاج', qty: 30, price: 640 }, { name: 'بلاستيك فقاعات هوائية', qty: 18, price: 2310 }] },
  { id: 'q3', number: 'QT-2603', clientName: 'مصنع الرحاب للأدوية', subject: 'أكياس تغليف دوائي معتمدة', date: D(9), currency: 'EGP', total: 41250, status: 'sent', at: T(9), items: [{ name: 'أكياس تغليف 50×70', qty: 125, price: 320 }] },
  { id: 'q4', number: 'QT-2604', clientName: 'شركة الشرق للتجارة العامة', subject: 'كرتون مضلع + شريط لاصق', date: D(14), currency: 'EGP', total: 18930, status: 'draft', at: T(14), items: [{ name: 'كرتون مضلع 3 طبقات', qty: 540, price: 24.5 }, { name: 'شريط لاصق مطبوع', qty: 60, price: 96 }] },
  { id: 'q5', number: 'QT-2605', clientName: 'مكتب المعمار للاستشارات', subject: 'ورق لف هندسي للمشاريع', date: D(20), currency: 'EGP', total: 12300, status: 'rejected', at: T(20), items: [{ name: 'ورق لف هندسي بني', qty: 30, price: 410 }] },
];

// ---------- العرض الفني ----------
const tech = [
  { id: 'tf1', number: 'TN-1201', clientName: 'شركة النيل للصناعات الغذائية', subject: 'مواصفات فنية — رول بلاستيك معتمد للغذاء', date: D(3), at: T(3), sourceQuoteId: 'q1', items: [] },
  { id: 'tf2', number: 'TN-1202', clientName: 'مصنع الرحاب للأدوية', subject: 'تقرير فني — أكياس تغليف دوائي', date: D(10), at: T(10), items: [] },
];

// ---------- أذون الاستلام ----------
const receipts = [
  { id: 'rc1', number: 'RC-0901', clientName: 'شركة النيل للصناعات الغذائية', subject: 'استلام دفعة رولات أولى', date: D(1), at: T(1), showCode: true, showQR: true, showPrice: true, extraCols: [{ name: 'رقم الشحنة' }, { name: 'عدد التوبات' }], items: [{ name: 'رول بلاستيك شفاف 100سم', qty: 12 }, { name: 'أكياس تغليف 50×70', qty: 60 }] },
  { id: 'rc2', number: 'RC-0902', clientName: 'مؤسسة الدلتا للمقاولات', subject: 'استلام فوم حماية', date: D(6), at: T(6), showCode: true, showQR: true, showPrice: false, extraCols: [], items: [{ name: 'فوم حماية للزجاج', qty: 15 }] },
];

// ---------- العروض المخصصة + التفويضات (K.tc) ----------
const customs = [
  { id: 'cu1', number: 'LT-0301', kind: 'custom', title: 'اعتذار عن عدم حضور الجلسة', targetName: 'شركة الشرق للتجارة', date: D(4), at: T(4) },
  { id: 'cu2', number: 'LT-0302', kind: 'custom', title: 'تنويه تعديل أسعار الربع الجديد', targetName: 'العملاء المعتمدون', date: D(7), at: T(7) },
  { id: 'cu3', number: 'LT-0303', kind: 'receipt', title: 'إيصال استلام عينات', targetName: 'مصنع الرحاب للأدوية', date: D(12), at: T(12) },
  { id: 'au1', number: 'PO-0701', kind: 'auth', delName: 'محمد سيد عبد الرحمن', delIdCard: '28901011234567', date: D(2), at: T(2), body: '' },
  { id: 'au2', number: 'PO-0702', kind: 'auth', delName: 'أحمد فتحي الشريف', delIdCard: '29205023456789', tenderId: 'td1', date: D(8), at: T(8), body: '' },
];

// ---------- العينات ----------
const samples = [
  { id: 'sa1', number: 'SP-0401', clientName: 'شركة النيل للصناعات الغذائية', subject: 'عينة رول بلاستيك غذائي', date: D(3), status: 'DELIVERED', at: T(3) },
  { id: 'sa2', number: 'SP-0402', clientName: 'مصنع الرحاب للأدوية', subject: 'عينة كيس تغليف دوائي', date: D(6), status: 'SENT', at: T(6) },
  { id: 'sa3', number: 'SP-0403', clientName: 'مؤسسة الدلتا للمقاولات', subject: 'عينة فوم + ملصق QR', date: D(10), status: 'ACCEPTED', at: T(10) },
  { id: 'sa4', number: 'SP-0404', clientName: 'شركة الشرق للتجارة العامة', subject: 'عينة كرتون مضلع مطبوع', date: D(15), status: 'RETURNING', subStatus: 'contacting', at: T(15) },
];

// ---------- أوامر التوريد ----------
const supplies = [
  { id: 'so1', number: 'PO-2601', clientName: 'شركة النيل للصناعات الغذائية', subject: 'توريد رولات + أكياس — الربع الأول', date: D(1), totalAmount: 96400, paidAmount: 60000, status: 'working', paymentStatus: 'partial_paid', at: T(1), items: [{ name: 'رول بلاستيك شفاف', qty: 20 }, { name: 'أكياس تغليف', qty: 150 }] },
  { id: 'so2', number: 'PO-2602', clientName: 'مصنع الرحاب للأدوية', subject: 'توريد أكياس دوائية معتمدة', date: D(8), totalAmount: 41250, paidAmount: 41250, status: 'delivered', paymentStatus: 'full_paid', at: T(8), items: [{ name: 'أكياس تغليف دوائي', qty: 125 }] },
  { id: 'so3', number: 'PO-2603', clientName: 'مؤسسة الدلتا للمقاولات', subject: 'توريد فوم حماية', date: D(13), totalAmount: 52800, paidAmount: 0, status: 'suspended', suspendReason: 'awaiting_dims', paymentStatus: 'incomplete', at: T(13), items: [{ name: 'فوم حماية', qty: 30 }] },
];

// ---------- المرتجعات ----------
const returns = [
  { id: 'rt1', number: 'RT-0201', supplyNumber: 'PO-2602', clientName: 'مصنع الرحاب للأدوية', date: D(5), status: 'received', at: T(5), items: [{ name: 'أكياس تغليف 50×70', quantity: 8 }, { name: 'كرتون مضلع', quantity: 0 }] },
  { id: 'rt2', number: 'RT-0202', supplyNumber: 'PO-2601', clientName: 'شركة النيل للصناعات الغذائية', date: D(2), status: 'pending', at: T(2), items: [{ name: 'رول بلاستيك — توب تالف', quantity: 2 }] },
];

// ---------- المناقصات ----------
const tenders = [
  { id: 'td1', number: 'TD-1101', entity: 'الهيئة العامة للتنمية الصناعية', subject: 'توريد مواد تغليف للمستودعات', deadline: D(-12), status: 'submitted', estValue: 380000, at: T(16) },
  { id: 'td2', number: 'TD-1102', entity: 'شركة مياه الشرب والصرف', subject: 'أكياس عينات معتمدة', deadline: D(-25), status: 'won', estValue: 152000, contract: { number: 'CT-2026-77', value: 152000 }, at: T(30) },
  { id: 'td3', number: 'TD-1103', entity: 'جامعة القاهرة — الإدارة الهندسية', subject: 'كرتون وتغليف للمطبوعات', deadline: D(-5), status: 'preparing', estValue: 74000, at: T(4) },
];

// ---------- المندوبون ----------
const couriers = [
  { id: 'cr1', name: 'محمود السيد', type: 'courier', phone: '0100 777 8899', vehicle: 'moto', plateNo: 'ق ط ر 4521', area: 'القاهرة والجيزة', active: true, at: T(10) },
  { id: 'cr2', name: 'شركة الإسراء للشحن السريع', type: 'company', phone: '16125', vehicle: 'van', area: 'جمهورية مصر', active: true, at: T(20) },
  { id: 'cr3', name: 'سيد عبد التواب', type: 'courier', phone: '0111 888 9900', vehicle: 'qtruck', plateNo: 'ن م ك 8830', area: 'العاصمة الإدارية — القاهرة الجديدة', active: false, at: T(40) },
];

// ---------- الشحن ----------
const shipping = [
  { id: 'sh1', number: 'WB-0501', date: D(1), clientName: 'شركة النيل للصناعات الغذائية', courierId: 'cr1', contents: '12 رول بلاستيك + 60 ألف كيس', srcNumber: 'PO-2601', srcType: 'supply', cost: 850, status: 'with_courier', at: T(1) },
  { id: 'sh2', number: 'WB-0502', date: D(3), clientName: 'مصنع الرحاب للأدوية', courierId: 'cr2', contents: '125 ألف كيس دوائي', srcNumber: 'PO-2602', srcType: 'supply', cost: 1900, status: 'in_transit', at: T(3) },
  { id: 'sh3', number: 'WB-0503', date: D(9), clientName: 'مكتب المعمار للاستشارات', courierId: 'cr1', contents: '10 رولات ورق لف', srcNumber: 'QT-2605', srcType: 'quote', cost: 400, status: 'delivered', at: T(9) },
];

// ---------- المدفوعات ----------
const payments = [
  { id: 'pay1', date: D(1), entity: 'شركة البلاستيك الوطنية — مورد', method: 'bank_transfer', reason: 'دفعة خامات الربع الأول', amount: 120000, paid: 120000, status: 'settled', payments: [{ date: D(1), amount: 120000 }], at: T(1) },
  { id: 'pay2', date: D(6), entity: 'مطبعة الألوان — مطبوعات', method: 'cheque', reason: 'شريط لاصق مطبوع', amount: 24000, paid: 10000, status: 'ongoing', payments: [{ date: D(6), amount: 10000 }], at: T(6) },
  { id: 'pay3', date: D(11), entity: 'إيجار المخزن — العبور', method: 'cash', reason: 'إيجار شهري', amount: 15000, paid: 0, status: 'ongoing', at: T(11) },
];

// ---------- المستحقات ----------
const receivables = [
  { id: 'rec1', date: D(1), entity: 'شركة النيل للصناعات الغذائية', reason: 'المتبقي من أمر التوريد PO-2601', amount: 36400, paid: 16400, status: 'ongoing', payments: [{ date: D(2), amount: 16400 }], at: T(1) },
  { id: 'rec2', date: D(13), entity: 'مؤسسة الدلتا للمقاولات', reason: 'عينة فوم معتمدة — أول التوريد', amount: 52800, paid: 0, status: 'ongoing', at: T(13) },
  { id: 'rec3', date: D(20), entity: 'شركة مياه الشرب والصرف', reason: 'دفعة مناقصة CT-2026-77', amount: 76000, paid: 76000, status: 'settled', payments: [{ date: D(21), amount: 76000 }], at: T(20) },
];

// ---------- إيصالات النقدية ----------
const cashReceipts = [
  { id: 'rcpt1', number: 'CR-0601', title: 'إيصال استلام دفعة نقدية', date: D(1), clientName: 'شركة النيل للصناعات الغذائية', amount: 16400, supplyId: 'so1', at: T(1) },
  { id: 'rcpt2', number: 'CR-0602', title: 'إيصال استلام دفعة مناقصة', date: D(20), clientName: 'شركة مياه الشرب والصرف', amount: 76000, at: T(20) },
];

// ---------- التصنيع ----------
const mfg = [
  { id: 'm1', number: 'WO-0801', date: D(4), clientName: 'شركة النيل للصناعات الغذائية', factory: 'مصنع النور للبلاستيك — الشرقية', status: 'working', at: T(4), items: [{ name: 'رول بلاستيك 100سم', qty: 20, total: 37000 }] },
  { id: 'm2', number: 'WO-0802', date: D(9), clientName: 'مصنع الرحاب للأدوية', factory: 'ورشة الأمل للتغليف — العبور', status: 'full_mfg', at: T(9), items: [{ name: 'أكياس دوائية 50×70', qty: 125, total: 40000 }] },
];

// ---------- مدخلات/مخرجات المخزن (K.io) ----------
const io = [
  { id: 'io1', number: 'IN-1501', type: 'in', date: D(3), clientName: 'مصنع النور للبلاستيك', woId: 'm1', at: T(3), items: [{ name: 'رول بلاستيك', qty: 12 }] },
  { id: 'io2', number: 'IN-1502', type: 'in', date: D(1), clientName: 'ورشة الأمل للتغليف', woId: 'm2', at: T(1), items: [{ name: 'أكياس دوائية', qty: 125 }] },
  { id: 'io3', number: 'OUT-1601', type: 'out', date: D(1), clientName: 'شركة النيل للصناعات الغذائية', supplyId: 'so1', at: T(1), items: [{ name: 'رول بلاستيك', qty: 12 }] },
  { id: 'io4', number: 'OUT-1602', type: 'out', date: D(8), clientName: 'مصنع الرحاب للأدوية', supplyId: 'so2', at: T(8), items: [{ name: 'أكياس تغليف', qty: 125 }] },
];

// ---------- المخزن ----------
const warehouses = [{ id: 'wh1', name: 'المخزن الرئيسي — العبور', at: T(30) }];
const whItems = [
  { id: 'w1', code: 'P-1001', name: 'رول بلاستيك شفاف 100سم', unit: 'رول', img: IMG.p1, minQty: 10, at: T(30) },
  { id: 'w2', code: 'P-1002', name: 'أكياس تغليف 50×70 سم', unit: 'ألف كيس', img: IMG.p2, minQty: 40, at: T(29) },
  { id: 'w3', code: 'P-1003', name: 'كرتون مضلع 3 طبقات', unit: 'كرتونة', img: IMG.p3, minQty: 0, at: T(28) },
  { id: 'w4', code: 'P-1005', name: 'فوم حماية للزجاج', unit: 'رول', img: IMG.p5, minQty: 15, at: T(27) },
  { id: 'w5', code: 'P-1006', name: 'بلاستيك فقاعات هوائية', unit: 'رول', img: IMG.p6, minQty: 0, at: T(26) },
  { id: 'w6', code: 'P-1007', name: 'ورق لف هندسي بني 90سم', unit: 'رول', minQty: 0, at: T(25) },
];
const whMoves = [
  { id: 'wm1', itemId: 'w1', whId: 'wh1', type: 'in', qty: 40, date: D(30), at: T(30) },
  { id: 'wm2', itemId: 'w1', whId: 'wh1', type: 'out', qty: 32, date: D(1), at: T(1) },
  { id: 'wm3', itemId: 'w2', whId: 'wh1', type: 'in', qty: 210, date: D(29), at: T(29) },
  { id: 'wm4', itemId: 'w2', whId: 'wh1', type: 'out', qty: 150, date: D(1), at: T(1) },
  { id: 'wm5', itemId: 'w3', whId: 'wh1', type: 'in', qty: 540, date: D(28), at: T(28) },
  { id: 'wm6', itemId: 'w4', whId: 'wh1', type: 'in', qty: 30, date: D(27), at: T(27) },
  { id: 'wm7', itemId: 'w4', whId: 'wh1', type: 'out', qty: 15, date: D(3), at: T(3) },
  { id: 'wm8', itemId: 'w5', whId: 'wh1', type: 'in', qty: 18, date: D(26), at: T(26) },
  { id: 'wm9', itemId: 'w6', whId: 'wh1', type: 'adj', qty: 30, date: D(25), at: T(25) },
];

// ---------- المستندات ----------
const documents = [
  { id: 'dcf1', name: 'مستندات الشركة', folder: true, parentId: null, files: [
    { id: 'df1', title: 'السجل التجاري.pdf', name: 'السجل التجاري.pdf', data: 'demo', at: T(60) },
    { id: 'df2', title: 'البطاقة الضريبية.jpg', name: 'البطاقة الضريبية.jpg', data: 'demo', at: T(60) },
    { id: 'df3', title: 'عقد إيجار المخزن.pdf', name: 'عقد إيجار المخزن.pdf', data: 'demo', at: T(45) },
  ], at: T(60) },
  { id: 'dcf2', name: 'عقود العملاء', folder: true, parentId: null, files: [
    { id: 'df4', title: 'عقد شركة النيل 2026.pdf', name: 'عقد شركة النيل 2026.pdf', data: 'demo', at: T(30) },
    { id: 'df5', title: 'اتفاقية إطارية — الدلتا.pdf', name: 'اتفاقية إطارية — الدلتا.pdf', data: 'demo', at: T(25) },
  ], at: T(30) },
  { id: 'dcf3', name: 'المناقصات والمشاريع', folder: true, parentId: null, files: [
    { id: 'df6', title: 'كراسة شروط — مياه الشرب.pdf', name: 'كراسة شروط — مياه الشرب.pdf', data: 'demo', at: T(20) },
    { id: 'df7', title: 'تأمين نهائي CT-2026-77.pdf', name: 'تأمين نهائي CT-2026-77.pdf', data: 'demo', at: T(18) },
  ], at: T(20) },
];

// ---------- الموظفون ----------
const employees = [
  { id: 'e1', name: 'محمد سيد عبد الرحمن', nationalId: '28901011234567', job: 'مندوب مبيعات', address: 'مدينة نصر — القاهرة', cardFront: 'demo', at: T(50) },
  { id: 'e2', name: 'فاطمة أحمد مصطفى', nationalId: '29503023456701', job: 'محاسبة', address: 'الهرم — الجيزة', at: T(48) },
  { id: 'e3', name: 'كريم وليد الشاذلي', nationalId: '29207034567012', job: 'أمين مخزن', address: 'العبور — القاهرة', at: T(46) },
  { id: 'e4', name: 'سيد عبد التواب حسن', nationalId: '28711045670123', job: 'سائق', address: 'السلام — القاهرة', at: T(44) },
];

// ---------- المستخدمون (شاشة الدخول تُخفى برمجياً في وضع الالتقاط) ----------
const users = [
  { id: 'u1', name: 'عمرو المشرف العام', username: 'amr', role: 'manager', active: true, salt: 'demo', pinHash: 'demo', at: T(60), perms: {} },
  { id: 'u2', name: 'هدى — مشرفة المبيعات', username: 'hoda', role: 'supervisor', active: true, salt: 'demo', pinHash: 'demo', at: T(40), perms: {} },
  { id: 'u3', name: 'أحمد — موظف مدخلات', username: 'ahmed', role: 'employee', active: true, salt: 'demo', pinHash: 'demo', at: T(20), perms: {} },
];

// ---------- النوتة (المهام) ----------
const notes = [
  { id: 'n1', text: 'متابعة العميل النيل — الدفعة المتبقية 20 ألف ج.م', done: false, due: D(-2), prio: 'urgent', at: T(3) },
  { id: 'n2', text: 'إرسال العينة SP-0402 لمصنع الرحاب', done: false, due: D(-1), prio: 'imp', at: T(4) },
  { id: 'n3', text: 'تجديد السجل التجاري قبل نهاية الشهر', done: false, due: D(-10), prio: 'normal', at: T(6) },
  { id: 'n4', text: 'استلام عرض سعر الكرتون من مورد جديد', done: true, due: D(5), prio: 'normal', at: T(8) },
];

// ---------- الفاتورة الإلكترونية (ids رقمية) ----------
const eInvoices = [
  { id: 1, number: 'EI-26001', date: D(1), docType: 'I', receiver: { type: 'B', name: 'شركة النيل للصناعات الغذائية', regN: '204-556-771', address: 'EG / Cairo / Cairo' }, lines: [{ description: 'رول بلاستيك شفاف 100سم × 150م', code: 'EGS-1001', qty: 20, price: 1850, taxType: 'T1', taxSub: 'V009', taxRate: 14 }, { description: 'أكياس تغليف 50×70', code: 'EGS-1002', qty: 150, price: 320, taxType: 'T1', taxSub: 'V009', taxRate: 14 }], totalSales: 83000, taxTotals: { T1: 11620 }, totalAmount: 94620, status: 'signed', submissionId: 'SUB-77213', at: T(1) },
  { id: 2, number: 'EI-26002', date: D(6), docType: 'I', receiver: { type: 'B', name: 'مصنع الرحاب للأدوية', regN: '301-445-220', address: 'EG / Alexandria / Amreya' }, lines: [{ description: 'أكياس تغليف دوائي 50×70', code: 'EGS-1002', qty: 125, price: 320, taxType: 'T1', taxSub: 'V009', taxRate: 14 }], totalSales: 40000, taxTotals: { T1: 5600 }, totalAmount: 45600, status: 'accepted', submissionId: 'SUB-77450', at: T(6) },
  { id: 3, number: 'EI-26003', date: D(10), docType: 'C', receiver: { type: 'B', name: 'شركة الشرق للتجارة العامة', regN: '330-221-115', address: 'EG / Cairo / Cairo' }, lines: [{ description: 'إشعار دائن — مرتجع كرتون', code: 'EGS-1003', qty: 40, price: 24.5, taxType: 'T1', taxSub: 'V009', taxRate: 14 }], totalSales: 980, taxTotals: { T1: 137.2 }, totalAmount: 1117.2, status: 'draft', at: T(10) },
];

// ---------- الحزمة النهائية: مفتاح localStorage → قيمة ----------
module.exports = function buildData() {
  const out = {};
  out.pq5_s = JSON.stringify(settings);
  out.pq5_c = JSON.stringify(clients);
  out.pq5_p = JSON.stringify(products);
  out.pq5_q = JSON.stringify(quotes);
  out.pq5_tf = JSON.stringify(tech);
  out.pq5_rc = JSON.stringify(receipts);
  out.pq5_tc = JSON.stringify(customs);
  out.pq5_sa = JSON.stringify(samples);
  out.pq5_so = JSON.stringify(supplies);
  out.pq5_rt = JSON.stringify(returns);
  out.pq5_td = JSON.stringify(tenders);
  out.pq5_cr = JSON.stringify(couriers);
  out.pq5_shp = JSON.stringify(shipping);
  out.pq5_pay = JSON.stringify(payments);
  out.pq5_rec = JSON.stringify(receivables);
  out.pq5_rcpt = JSON.stringify(cashReceipts);
  out.pq5_mfg = JSON.stringify(mfg);
  out.pq5_io = JSON.stringify(io);
  out.pq5_wh = JSON.stringify(warehouses);
  out.pq5_wi = JSON.stringify(whItems);
  out.pq5_wm = JSON.stringify(whMoves);
  out.pq5_dc = JSON.stringify(documents);
  out.pq5_emp = JSON.stringify(employees);
  out.pq5_usr = JSON.stringify(users);
  out.pq5_nt = JSON.stringify(notes);
  out.pq5_ei = JSON.stringify(eInvoices);
  // عدادات الترقيم (أعلى من أعلى رقم مستخدم)
  out.pq5_n = '2620';
  out.pq5_ntf = '1203'; out.pq5_nrc = '903'; out.pq5_nau = '703'; out.pq5_nsa = '405';
  out.pq5_nso = '2604'; out.pq5_nrt = '203'; out.pq5_nshp = '504'; out.pq5_nrcpt = '603';
  out.pq5_nmfg = '803'; out.pq5_nio = '1603'; out.pq5_npy = '101'; out.pq5_nei = '26004';
  out.pq5_nc = '7'; out.pq5_nr = '9'; out.pq5_nwb = '502';
  return out;
};
