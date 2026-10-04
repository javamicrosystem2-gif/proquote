-- ============================================================
-- ProQuote — جدولي الباقات والتراخيص (للمطور Amr Nada)
-- نفّذ هذا في SQL Editor بمشروع Supabase
-- ترقية-آمنة: يعمل على قاعدة جديدة أو قديمة بأي مخطط سابق، ويُعاد تشغيله بلا ضرر
-- ============================================================

-- 1) جدول الباقات (يتحكم فيه المطور فقط — يقرأه المشتركون)
create table if not exists pq_plans (
  plan_key   text primary key,   -- solo_full / small_full / med_full / ulim_full
  name       text,
  price_m    numeric default 0,
  price_y    numeric default 0,
  paypal_m   text,
  paypal_y   text,
  updated_at timestamptz default now()
);

-- 🔧 ترقية المخطط القديم (supabase-plans.sql القديم بأعمدة price/currency/paypal_url)
alter table pq_plans add column if not exists name       text;
alter table pq_plans add column if not exists price_m    numeric default 0;
alter table pq_plans add column if not exists price_y    numeric default 0;
alter table pq_plans add column if not exists paypal_m   text;
alter table pq_plans add column if not exists paypal_y   text;
alter table pq_plans add column if not exists updated_at timestamptz default now();

alter table pq_plans enable row level security;
drop policy if exists "pq_plans read" on pq_plans;
create policy "pq_plans read" on pq_plans for select using (true);
-- الكتابة فقط بمفتاح service_role (المطور) — anon لا يكتب

-- 2) جدول التراخيص (أكواد التفعيل)
create table if not exists pq_licenses (
  id           serial primary key,
  device_id    text,                    -- (قديم) يُستبدل بـ bound_device
  tier         text default 'professional',
  days         int default 365,
  key          text unique,
  status       text default 'unused',   -- unused | active | cancelled | revoked
  email        text,                    -- بريد المشتري (من PayPal/الإدارة)
  bound_device text,                    -- معرف الجهاز المفعّل عليه (8 أحرف)
  activated_at timestamptz,
  expires_at   timestamptz,
  created_at   timestamptz default now()
);

-- 🔧 ترقية قواعد قائمة (آمنة للتكرار)
alter table pq_licenses add column if not exists email           text;
alter table pq_licenses add column if not exists bound_device    text;
alter table pq_licenses add column if not exists activated_at    timestamptz;
alter table pq_licenses add column if not exists expires_at      timestamptz;
alter table pq_licenses add column if not exists subscription_id text; -- ربط الاشتراك في PayPal (تمديد تلقائي عند التجديد)
alter table pq_licenses alter column device_id drop not null;    -- المخطط القديم كان يفرضه — الإصدار الجديد لا يحتاجه

alter table pq_licenses enable row level security;
-- 🔒 لا سياسات عامة إطلاقاً: القراءة والكتابة عبر service_role فقط (دوال Edge / admin-panel)
drop policy if exists "pq_lic read" on pq_licenses;

-- 🧹 إزالة صفوف المخطط القديم إن وُجدت (مفاتيح solo_m/solo_y بلا _full)
delete from pq_plans where plan_key !~ '_full$';

-- أسعار مبدئية بالدولار (عدّلها من لوحة المطور admin-panel.html)
insert into pq_plans (plan_key, name, price_m, price_y) values
  ('solo_full',  'فرد',              19.99, 199),
  ('small_full', 'شركات صغيرة',      39,    360),
  ('med_full',   'شركات متوسطة',     79,    480),
  ('ulim_full',  'غير محدود',        99,    999)
on conflict (plan_key) do update set
  price_m = excluded.price_m,
  price_y = excluded.price_y;
