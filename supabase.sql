-- ============================================================
-- ProQuote — تهيئة Supabase للمزامنة السحابية
-- 1) أنشئ مشروعاً مجانياً على https://supabase.com
-- 2) افتح SQL Editor والصق هذا الملف كاملاً ثم Run
-- 3) من Settings → API انسخ Project URL و anon public key
-- 4) ألصقهما في البرنامج: الإعدادات ← المزامنة ← المزامنة السحابية
-- ============================================================

create table if not exists pq_state (
  key        text primary key,
  val        text not null,
  device     text,
  updated_at timestamptz default now()
);

alter table pq_state enable row level security;

-- وصول كامل للمفتاح العام (anon) — بيانات مشفرة النقل (TLS) ومحمية بالمفتاح
drop policy if exists "pq_state anon read" on pq_state;
create policy "pq_state anon read" on pq_state for select using (true);

drop policy if exists "pq_state anon write" on pq_state;
create policy "pq_state anon write" on pq_state for insert with check (true);

drop policy if exists "pq_state anon update" on pq_state;
create policy "pq_state anon update" on pq_state for update using (true) with check (true);

-- فهرس لتسريع الجلب
create index if not exists pq_state_updated_idx on pq_state (updated_at desc);
