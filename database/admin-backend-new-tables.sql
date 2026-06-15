-- ============================================================
-- 知己知途 admin/counselor 後台多頁式重構 — 新增資料表 (Phase 0)
--
-- 重要：本檔案「只新增」三張全新資料表 + 兩個 helper function，
-- 完全不修改、不覆蓋既有資料表 (profiles / batches / submissions /
-- license_plans / counselor_authorizations)。對前台測驗、計分、
-- 批次碼驗證、PDF、Email 流程零影響。
--
-- 使用方式：登入 Supabase Dashboard → SQL Editor → 貼上整段執行一次。
-- 可重複執行（皆使用 if not exists / or replace，不會報錯或重建）。
-- ============================================================

-- 判斷目前登入者是否為最高管理者 (profiles.role = 'owner')
create or replace function is_owner()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'owner'
  );
$$;

-- 取得目前登入者的 email（小寫），優先讀 profiles，其次讀 JWT
create or replace function current_email()
returns text
language sql
stable
as $$
  select lower(coalesce(
    (select email from profiles where id = auth.uid()),
    auth.jwt() ->> 'email'
  ));
$$;

-- ------------------------------------------------------------
-- 1. credit_transactions：諮詢師額度交易紀錄（帳本，新增/扣除/補回）
--    某諮詢師「剩餘額度」=
--      既有 counselor_authorizations 的 (purchased_quantity - used_quantity) 加總（唯讀保留）
--    + credit_transactions 的 delta 加總（新帳本，預設 0）
-- ------------------------------------------------------------
create table if not exists credit_transactions (
  id uuid primary key default gen_random_uuid(),
  counselor_email text not null,
  delta integer not null,
  type text not null default 'adjust', -- grant | deduct | restore | batch_create
  reason text,
  related_batch_id uuid references batches(id) on delete set null,
  related_plan_id uuid references license_plans(id) on delete set null,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);
alter table credit_transactions enable row level security;

drop policy if exists "owner full access on credit_transactions" on credit_transactions;
create policy "owner full access on credit_transactions" on credit_transactions
  for all using (is_owner()) with check (is_owner());

drop policy if exists "consultant read own credit_transactions" on credit_transactions;
create policy "consultant read own credit_transactions" on credit_transactions
  for select using (lower(counselor_email) = current_email());

-- ------------------------------------------------------------
-- 2. logs：系統操作紀錄
--    owner 可完整讀寫；一般登入者（諮詢師）僅可新增自己的操作紀錄
--    （供 counselor-batches.html 等寫入），不可讀取（系統紀錄僅 owner 可查）
-- ------------------------------------------------------------
create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid,
  operator_name text,
  operator_role text,
  action_type text not null,
  target_type text,
  target_id text,
  before_data jsonb,
  after_data jsonb,
  client_info jsonb,
  created_at timestamptz not null default now()
);
alter table logs enable row level security;

drop policy if exists "owner full access on logs" on logs;
create policy "owner full access on logs" on logs
  for all using (is_owner()) with check (is_owner());

drop policy if exists "authenticated insert logs" on logs;
create policy "authenticated insert logs" on logs
  for insert with check (auth.uid() is not null);

-- ------------------------------------------------------------
-- 3. report_templates：報告資料庫管理（Holland/SUPER/創業適性/報告模板）
--    純後台管理介面，與 index.html 實際報告產出程式完全脫鉤，僅 owner 可用
-- ------------------------------------------------------------
create table if not exists report_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null,       -- holland | super | startup | case_template | counselor_template | ai_rule
  template_key text not null,
  title text,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(category, template_key)
);
alter table report_templates enable row level security;

drop policy if exists "owner full access on report_templates" on report_templates;
create policy "owner full access on report_templates" on report_templates
  for all using (is_owner()) with check (is_owner());
