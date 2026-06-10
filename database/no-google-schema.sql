-- 知己知途｜職涯探索冒險遊戲｜不走 Google 正式資料庫結構
-- Target: Supabase PostgreSQL

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  email text unique,
  display_name text not null,
  password_hash text not null,
  role text not null check (role in ('owner', 'consultant')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists license_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_cents integer not null default 0,
  test_quantity integer not null default 1,
  status text not null default 'active' check (status in ('active', 'disabled')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists consultant_credits (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references users(id),
  plan_id uuid references license_plans(id),
  amount integer not null,
  reason text not null,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references users(id),
  batch_code text not null,
  batch_name text not null,
  short_code text unique not null,
  quantity integer not null default 1,
  completed_count integer not null default 0,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  counselor_email text not null,
  status text not null default 'active' check (status in ('active', 'stopped', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists results (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id),
  consultant_id uuid not null references users(id),
  short_code text not null,
  student_name text not null,
  student_email text not null,
  gender text,
  age text,
  phone text,
  holland_code text,
  top_riasec jsonb not null default '[]'::jsonb,
  value_scores jsonb not null default '{}'::jsonb,
  holland_scores jsonb not null default '{}'::jsonb,
  raw_answers jsonb not null default '{}'::jsonb,
  counselor_advice text,
  pdf_storage_path text,
  counselor_report_storage_path text,
  completion_rate integer not null default 100,
  status text not null default 'completed' check (status in ('completed', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists email_logs (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references results(id),
  recipient_email text not null,
  recipient_type text not null check (recipient_type in ('student', 'consultant')),
  status text not null check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (result_id, recipient_type)
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id),
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_batches_short_code on batches(short_code);
create index if not exists idx_batches_consultant on batches(consultant_id);
create index if not exists idx_results_batch on results(batch_id);
create index if not exists idx_results_consultant on results(consultant_id);
create index if not exists idx_results_email on results(student_email);

create or replace function consultant_credit_balance(p_consultant_id uuid)
returns integer
language sql
stable
as $$
  select coalesce(sum(amount), 0)::integer
  from consultant_credits
  where consultant_id = p_consultant_id;
$$;

create or replace function consume_credit_for_result(
  p_batch_id uuid,
  p_short_code text,
  p_student_name text,
  p_student_email text,
  p_gender text,
  p_age text,
  p_phone text,
  p_holland_code text,
  p_top_riasec jsonb,
  p_value_scores jsonb,
  p_holland_scores jsonb,
  p_raw_answers jsonb,
  p_counselor_advice text,
  p_completion_rate integer
)
returns table(result_id uuid, consultant_id uuid, short_code text)
language plpgsql
as $$
declare
  v_batch batches%rowtype;
  v_balance integer;
  v_result_id uuid;
begin
  select *
  into v_batch
  from batches
  where id = p_batch_id
    and short_code = upper(trim(p_short_code))
    and status = 'active'
  for update;

  if not found then
    raise exception '此任務短碼不存在或未啟用';
  end if;

  if v_batch.starts_at > now() then
    raise exception '此任務尚未開始';
  end if;

  if v_batch.ends_at < now() then
    raise exception '此任務已結束';
  end if;

  if v_batch.completed_count >= v_batch.quantity then
    raise exception '此批次名額已滿';
  end if;

  select consultant_credit_balance(v_batch.consultant_id)
  into v_balance;

  if v_balance <= 0 then
    raise exception '諮詢師額度不足，請聯絡管理者';
  end if;

  insert into results (
    batch_id,
    consultant_id,
    short_code,
    student_name,
    student_email,
    gender,
    age,
    phone,
    holland_code,
    top_riasec,
    value_scores,
    holland_scores,
    raw_answers,
    counselor_advice,
    completion_rate
  )
  values (
    v_batch.id,
    v_batch.consultant_id,
    v_batch.short_code,
    p_student_name,
    p_student_email,
    p_gender,
    p_age,
    p_phone,
    p_holland_code,
    coalesce(p_top_riasec, '[]'::jsonb),
    coalesce(p_value_scores, '{}'::jsonb),
    coalesce(p_holland_scores, '{}'::jsonb),
    coalesce(p_raw_answers, '{}'::jsonb),
    p_counselor_advice,
    coalesce(p_completion_rate, 100)
  )
  returning id into v_result_id;

  update batches
  set completed_count = completed_count + 1,
      updated_at = now()
  where id = v_batch.id;

  insert into consultant_credits (
    consultant_id,
    amount,
    reason,
    created_by
  )
  values (
    v_batch.consultant_id,
    -1,
    '學生完成測驗扣除 1 額度',
    v_batch.consultant_id
  );

  result_id := v_result_id;
  consultant_id := v_batch.consultant_id;
  short_code := v_batch.short_code;
  return next;
end;
$$;
