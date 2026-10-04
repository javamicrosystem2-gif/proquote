// ============================================================
// ProQuote — دالة تفعيل الترخيص (Supabase Edge Function)
// تستقبل: POST { key, deviceId }
// تتحقق من كود التفعيل في جدول pq_licenses، توقّع الترخيص بالمفتاح
// الخاص (RSA-2048)، تربطه بالجهاز، وترد به موقَّعاً.
//
// الأسرار المطلوبة في Edge Functions ← Secrets:
//   LICENSE_SIGNING_KEY   = مفتاح RSA الخاص (PEM pkcs8) — لا يغادر السيرفر
//   (SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY تُحقن تلقائياً)
//
// النشر: supabase functions deploy activate-license --no-verify-jwt
// ============================================================

const PRIV_PEM = (Deno.env.get('LICENSE_SIGNING_KEY') || '').replace(/\\n/g, '\n');
const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ---------- أدوات ----------
const pemToBuf = (pem: string): ArrayBuffer => {
  const b64 = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
};

async function signPayload(payloadStr: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToBuf(PRIV_PEM),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(payloadStr));
  const bytes = new Uint8Array(sig);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// حدّ تخمين بسيط (لكل عزلة) — 12 محاولة/دقيقة لكل معرّف جهاز
const hits = new Map<string, { n: number; t: number }>();
function rateLimited(id: string): boolean {
  const now = Date.now();
  const h = hits.get(id);
  if (!h || now - h.t > 60_000) { hits.set(id, { n: 1, t: now }); return false; }
  h.n++;
  return h.n > 12;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

// ---------- الدالة ----------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);
  if (!PRIV_PEM.includes('PRIVATE KEY')) return json({ success: false, error: 'server not configured' }, 500);

  let key = '', deviceId = '';
  try {
    const b = await req.json();
    key = String(b.key || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    deviceId = String(b.deviceId || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  } catch (_) { /* ignore */ }
  if (!key || key.length < 10 || !deviceId) return json({ success: false, error: 'بيانات ناقصة' }, 400);
  if (rateLimited(deviceId + ':' + key)) return json({ success: false, error: 'محاولات كثيرة — انتظر دقيقة' }, 429);

  try {
    const sbHeaders: Record<string, string> = {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json'
    };
    // جلب الكود (بمفتاح الخدمة — الجدول مغلق عن العام بعد RLS)
    const sel = await fetch(SB_URL + '/rest/v1/pq_licenses?key=eq.' + encodeURIComponent(key) + '&select=*', {
      headers: sbHeaders
    });
    if (!sel.ok) return json({ success: false, error: 'خطأ في قاعدة البيانات' }, 500);
    const rows = await sel.json() as Array<Record<string, unknown>>;
    const row = rows && rows[0];
    if (!row) return json({ success: false, error: 'كود التفعيل غير صحيح' }, 404);
    if (row.status === 'revoked') return json({ success: false, error: 'هذا الكود ملغي — تواصل مع الدعم' }, 403);
    const bound = row.bound_device ? String(row.bound_device).toUpperCase() : null;
    if (bound && bound !== deviceId) return json({ success: false, error: 'هذا الكود مرتبط بجهاز آخر' }, 403);

    // حساب الانتهاء (idempotent: إعادة تفعيل نفس الجهاز تعيد نفس الترخيص)
    let expiry: number;
    if (bound === deviceId && row.expires_at) {
      expiry = new Date(String(row.expires_at)).getTime();
    } else {
      const days = Number(row.days) || 365;
      expiry = Date.now() + days * 24 * 60 * 60 * 1000;
    }
    if (expiry && Date.now() > expiry) return json({ success: false, error: 'انتهت صلاحية هذا الكود' }, 403);

    // الترخيص الموقّع (ترتيب الحقول ثابت — سلسلة واحدة موقّعة كما هي)
    const payloadStr = JSON.stringify({ deviceId: deviceId, tier: row.tier || 'professional', expiry: expiry, issued: Date.now() });
    const sig = await signPayload(payloadStr);

    // ربط الجهاز وتسجيل التفعيل
    const upd = await fetch(SB_URL + '/rest/v1/pq_licenses?key=eq.' + encodeURIComponent(key), {
      method: 'PATCH',
      headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status: 'active', bound_device: deviceId, activated_at: new Date().toISOString(), expires_at: new Date(expiry).toISOString() })
    });
    if (!upd.ok) return json({ success: false, error: 'تعذر تسجيل التفعيل' }, 500);

    return json({ success: true, license: { payload: payloadStr, sig } });
  } catch (e) {
    return json({ success: false, error: 'خطأ في الخادم' }, 500);
  }
});
