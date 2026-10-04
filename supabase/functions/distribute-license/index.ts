// ============================================================
// ProQuote — أتمتة توزيع أكواد التفعيل (Supabase Edge Function)
// تستقبل Webhooks من PayPal وتنفذ:
//   BILLING.SUBSCRIPTION.ACTIVATED → إصدار كود جديد + بريد للمشترك
//   BILLING.SUBSCRIPTION.RENEWED   → تمديد انتهاء الترخيص تلقائياً
//   BILLING.SUBSCRIPTION.CANCELLED → وسم (يظل سارياً حتى الانتهاء)
//
// 🔒 كل حدث يُتحقق من توقيع PayPal الحقيقي (verify-webhook-signature)
//    — لا يمكن تزوير إشعار دفع للحصول على كود.
//
// الأسرار المطلوبة (Edge Functions ← Secrets):
//   PAYPAL_CLIENT_ID    , PAYPAL_SECRET     (من developer.paypal.com)
//   PAYPAL_WEBHOOK_ID   (معرف الويبهوك من إعداداته)
//   PAYPAL_ENV          = live أو sandbox (اختياري — الافتراضي live)
//   RESEND_API_KEY      (من resend.com — إرسال البريد)
//   MAIL_FROM           (مثل: ProQuote <onboarding@resend.dev>)
//   (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY تُحقن تلقائياً)
//
// النشر: supabase functions deploy distribute-license --no-verify-jwt
// ثم في PayPal ← Webhooks أضف:
//   https://<project>.supabase.co/functions/v1/distribute-license
// ============================================================

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PLAN_MAP: Record<string, { tier: string; days: number }> = {
  // الشهرية
  'P-79Y10184HV8984701NK6QOHA': { tier: 'solo', days: 31 },
  'P-8BF09849DB984670MNK6QTLY': { tier: 'small', days: 31 },
  'P-3AM723754L7800622NK6QVGA': { tier: 'med', days: 31 },
  'P-00T60558V0503131NNK6QWJQ': { tier: 'ulim', days: 31 },
  // السنوية
  'P-6F9852959W923042YNK6QXOY': { tier: 'solo', days: 366 },
  'P-1YR373559E473603LNK6QZIQ': { tier: 'small', days: 366 },
  // (med السنوية = نفس معرف small السنوية كما أكدها المطوّر — تعامل small)
  'P-67859581MF821035CNK6QZ7A': { tier: 'ulim', days: 366 }
};

// ---------- أدوات ----------
const sbHeaders: Record<string, string> = {
  'apikey': SB_KEY,
  'Authorization': 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json'
};

function makeKey(): string {
  const cs = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const grp = () => Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => cs[b % cs.length]).join('');
  return `PQ-${grp()}-${grp()}-${grp()}-${grp()}`;
}

async function paypalToken(): Promise<string> {
  const base = Deno.env.get('PAYPAL_ENV') === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
  const id = Deno.env.get('PAYPAL_CLIENT_ID')!, sec = Deno.env.get('PAYPAL_SECRET')!;
  const r = await fetch(base + '/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + btoa(id + ':' + sec), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  const j = await r.json();
  return j.access_token;
}

async function verifySignature(req: Request, rawBody: string, eventId: string): Promise<boolean> {
  try {
    const token = await paypalToken();
    const base = Deno.env.get('PAYPAL_ENV') === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
    const r = await fetch(base + '/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_algo: req.headers.get('paypal-auth-algo') || '',
        cert_url: req.headers.get('paypal-cert-url') || '',
        transmission_id: req.headers.get('paypal-transmission-id') || '',
        transmission_sig: req.headers.get('paypal-transmission-sig') || '',
        transmission_time: req.headers.get('paypal-transmission-time') || '',
        webhook_id: Deno.env.get('PAYPAL_WEBHOOK_ID') || '',
        webhook_event: JSON.parse(rawBody)
      })
    });
    const j = await r.json();
    console.log(`[sig] event=${eventId} status=${j.verification_status}`);
    return j.verification_status === 'SUCCESS';
  } catch (e) {
    console.error('[sig] error', e);
    return false;
  }
}

async function sendMail(to: string, key: string, tier: string, days: number): Promise<boolean> {
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><body style="font-family:Tahoma,Arial;background:#0b1420;color:#e8eef5;padding:28px;text-align:center">
  <div style="max-width:520px;margin:0 auto;background:#0f1a28;border:1px solid #1c2a3d;border-radius:16px;padding:28px">
    <div style="font-size:26px">🎉</div>
    <h2 style="margin:8px 0;color:#00a885">تم تفعيل اشتراكك في ProQuote</h2>
    <p style="font-size:13px;color:#9fb0c3;line-height:2">شكراً لاشتراكك في باقة <b style="color:#e8eef5">${tier}</b> لمدة <b style="color:#e8eef5">${days} يوماً</b>.<br>هذا كود التفعيل الخاص بك — يعمل على جهاز واحد:</p>
    <div style="background:#0b1420;border:2px dashed #00a885;border-radius:12px;padding:14px;font-family:monospace;font-size:19px;font-weight:800;color:#00a885;direction:ltr;letter-spacing:1px">${key}</div>
    <p style="font-size:12.5px;color:#9fb0c3;line-height:2;margin-top:14px"><b style="color:#e8eef5">خطوات التفعيل:</b><br>١) ثبّت البرنامج وافتحه<br>٢) من القائمة الجانبية اضغط شارة الترخيص (تفعيل الترخيص)<br>٣) انسخ «معرّف الجهاز» (8 أحرف) — يُنسخ بضغطة<br>٤) ألصق كود التفعيل أعلاه في حقل «مفتاح الترخيص» واضغط تفعيل</p>
    <p style="font-size:11px;color:#67788c;margin-top:12px">الدعم الفني: t.me/javamicro • amrnada@mail.ru</p>
  </div></body></html>`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + Deno.env.get('RESEND_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: Deno.env.get('MAIL_FROM') || 'ProQuote <onboarding@resend.dev>', to: [to], subject: 'كود تفعيل ProQuote — ' + key, html })
    });
    return r.ok;
  } catch (_) { return false; }
}

// ---------- المعالج ----------
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok', { status: 200 });

  const raw = await req.text();
  let event: any = null;
  try { event = JSON.parse(raw); } catch (_) { /* ignore */ }
  const type: string = event?.event_type || '';

  // 1) التحقق من التوقيع — بوابية كل شيء
  const okSig = await verifySignature(req, raw, event?.id || '?');
  if (!okSig) return new Response(JSON.stringify({ success: false, error: 'invalid signature' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  try {
    const res = event?.resource || {};

    if (type === 'BILLING.SUBSCRIPTION.ACTIVATED' || type === 'BILLING.SUBSCRIPTION.CREATED') {
      const email: string = res?.subscriber?.email_address || res?.subscriber?.payer_email || '';
      const planId: string = res?.plan_id || '';
      const subId: string = res?.id || '';
      const plan = PLAN_MAP[planId];

      // idempotent: إعادة إرسال PayPal لنفس الاشتراك لا تُصدر كوداً جديداً
      if (subId) {
        const dup = await fetch(SB_URL + '/rest/v1/pq_licenses?subscription_id=eq.' + encodeURIComponent(subId) + '&select=key', { headers: sbHeaders });
        const dups = await dup.json();
        if (Array.isArray(dups) && dups.length) {
          return new Response(JSON.stringify({ success: true, note: 'already issued', key: dups[0].key }), { headers: { 'Content-Type': 'application/json' } });
        }
      }
      if (!email || !plan) {
        console.warn('[dist] missing email/plan', { email: !!email, planId });
        return new Response(JSON.stringify({ success: false, error: 'missing email or plan' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      const key = makeKey();
      const ins = await fetch(SB_URL + '/rest/v1/pq_licenses', {
        method: 'POST',
        headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ key, tier: plan.tier, days: plan.days, status: 'unused', email, subscription_id: subId })
      });
      if (!ins.ok) return new Response(JSON.stringify({ success: false, error: 'db insert failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

      const mailed = await sendMail(email, key, plan.tier, plan.days);
      console.log(`[dist] issued ${key} tier=${plan.tier} to=${email} mailed=${mailed}`);
      return new Response(JSON.stringify({ success: true, issued: true, emailed: mailed }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (type === 'BILLING.SUBSCRIPTION.RENEWED') {
      const subId: string = res?.id || '';
      const planId: string = res?.plan_id || '';
      const plan = PLAN_MAP[planId];
      if (!subId || !plan) return new Response(JSON.stringify({ success: false, error: 'missing sub/plan' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

      const sel = await fetch(SB_URL + '/rest/v1/pq_licenses?subscription_id=eq.' + encodeURIComponent(subId) + '&select=id,expires_at,email', { headers: sbHeaders });
      const rows = await sel.json();
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) return new Response(JSON.stringify({ success: false, error: 'license not found for subscription' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

      // التمديد من اللحظة الأبعد (لا نخصم المتبقي إن كان قبل الانتهاء)
      const base = Math.max(Date.now(), row.expires_at ? new Date(row.expires_at).getTime() : Date.now());
      const newExp = new Date(base + plan.days * 86400000).toISOString();
      await fetch(SB_URL + '/rest/v1/pq_licenses?id=eq.' + row.id, {
        method: 'PATCH',
        headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ expires_at: newExp, status: 'active' })
      });
      console.log(`[dist] renewed sub=${subId} → ${newExp}`);
      return new Response(JSON.stringify({ success: true, renewed: true, expires_at: newExp }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (type === 'BILLING.SUBSCRIPTION.CANCELLED' || type === 'BILLING.SUBSCRIPTION.EXPIRED') {
      const subId: string = res?.id || '';
      if (subId) {
        await fetch(SB_URL + '/rest/v1/pq_licenses?subscription_id=eq.' + encodeURIComponent(subId), {
          method: 'PATCH',
          headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ status: 'cancelled' })
        });
      }
      return new Response(JSON.stringify({ success: true, marked: type }), { headers: { 'Content-Type': 'application/json' } });
    }

    // أحداث غير معالجة — نقرّ بها (PayPal لا يعيد الإرسال)
    return new Response(JSON.stringify({ success: true, ignored: type }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[dist] fatal', e);
    return new Response(JSON.stringify({ success: false, error: 'server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
