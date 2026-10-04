-- ============================================================
-- ProQuote — جدول خطط الاشتراك (اختياري — يجلب الأسعار من السحابة)
-- نفّذه في SQL Editor بمشروع Supabase نفسه بعد pq_state
-- ============================================================

create table if not exists pq_plans (
  plan_key   text primary key,   -- solo_m / solo_y / small_m / small_y / med_m / med_y / ulim_m / ulim_y
  name       text,
  price      numeric not null default 0,
  currency   text default 'EGP',
  max_users  int default 1,
  paypal_url text,
  updated_at timestamptz default now()
);

alter table pq_plans enable row level security;
drop policy if exists "pq_plans read" on pq_plans;
create policy "pq_plans read" on pq_plans for select using (true);

-- أسعار مبدئية — عدّلها كما تشاء ثم اربط البرنامج
insert into pq_plans (plan_key, name, price, max_users) values
  ('solo_m',  'فرد — شهري',      99,  1),
  ('solo_y',  'فرد — سنوي',     499,  1),
  ('small_m', 'شركات صغيرة — شهري', 249, 3),
  ('small_y', 'شركات صغيرة — سنوي', 1299, 3),
  ('med_m',   'شركات متوسطة — شهري', 449, 8),
  ('med_y',   'شركات متوسطة — سنوي', 2299, 8),
  ('ulim_m',  'غير محدود — شهري',   699, 0),
  ('ulim_y',  'غير محدود — سنوي',   3499, 0)
on conflict (plan_key) do nothing;
