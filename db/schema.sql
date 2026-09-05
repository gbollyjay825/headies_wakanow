create table if not exists travel_requests (
  id text primary key,
  type text not null,
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  summary text not null default '',
  status text not null default 'New',
  details jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists travel_requests_status_updated_idx
  on travel_requests (status, updated_at desc);

create index if not exists travel_requests_type_updated_idx
  on travel_requests (type, updated_at desc);

create table if not exists visa_eligible_applicants (
  id text primary key,
  name text not null default '',
  email text not null unique,
  phone text not null default '',
  access_code text not null,
  category text not null default '',
  user_type text not null default 'basic',
  status text not null default 'active',
  source text not null default 'admin',
  notes text not null default '',
  signup_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visa_eligible_status_check check (status in ('pending', 'active', 'blocked')),
  constraint visa_eligible_user_type_check check (user_type in ('basic', 'premium', 'staff', 'nominee')),
  constraint visa_eligible_source_check check (source in ('admin', 'signup'))
);

create index if not exists visa_eligible_status_updated_idx
  on visa_eligible_applicants (status, updated_at desc);

do $$
begin
  alter table visa_eligible_applicants
    add column if not exists source text not null default 'admin',
    add column if not exists user_type text not null default 'basic',
    add column if not exists signup_completed_at timestamptz;

  update visa_eligible_applicants
    set source = 'admin'
    where source is null or source = '';

  update visa_eligible_applicants
    set user_type = 'basic'
    where user_type is null or user_type = '';

  if exists (
    select 1 from pg_constraint
    where conname = 'visa_eligible_status_check'
      and conrelid = 'visa_eligible_applicants'::regclass
  ) then
    alter table visa_eligible_applicants drop constraint visa_eligible_status_check;
  end if;

  alter table visa_eligible_applicants
    add constraint visa_eligible_status_check
    check (status in ('pending', 'active', 'blocked'));

  if exists (
    select 1 from pg_constraint
    where conname = 'visa_eligible_user_type_check'
      and conrelid = 'visa_eligible_applicants'::regclass
  ) then
    alter table visa_eligible_applicants drop constraint visa_eligible_user_type_check;
  end if;

  alter table visa_eligible_applicants
    add constraint visa_eligible_user_type_check
    check (user_type in ('basic', 'premium', 'staff', 'nominee'));

  if exists (
    select 1 from pg_constraint
    where conname = 'visa_eligible_source_check'
      and conrelid = 'visa_eligible_applicants'::regclass
  ) then
    alter table visa_eligible_applicants drop constraint visa_eligible_source_check;
  end if;

  alter table visa_eligible_applicants
    add constraint visa_eligible_source_check
    check (source in ('admin', 'signup'));
end $$;

create table if not exists visa_applications (
  id text primary key,
  applicant_id text references visa_eligible_applicants(id) on delete set null,
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  applicants integer not null default 1,
  applicant_category text not null default '',
  user_type text not null default 'basic',
  passport_expiry date,
  travel_date date,
  travel_history text not null default '',
  role text not null default '',
  salary text not null default '',
  employment_length text not null default '',
  notes text not null default '',
  fee text not null default 'Basic visa package: visa fee included, admin processing fee included, Headies ticket fee included',
  status text not null default 'Draft',
  payment_status text not null default 'Unpaid',
  payment_reference text not null default '',
  payment_amount integer not null default 0,
  payment_currency text not null default 'NGN',
  payment_paid_at timestamptz,
  reviewed_at timestamptz,
  passport_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visa_applications_status_check check (
    status in ('Draft', 'Submitted', 'In review', 'Missing documents', 'Approved', 'Declined')
  ),
  constraint visa_applications_payment_status_check check (
    payment_status in ('Unpaid', 'Pending', 'Paid', 'Failed')
  ),
  constraint visa_applications_applicants_check check (applicants > 0)
);

create index if not exists visa_applications_status_updated_idx
  on visa_applications (status, updated_at desc);

create index if not exists visa_applications_applicant_idx
  on visa_applications (applicant_id);

alter table visa_applications
  add column if not exists user_type text not null default 'basic',
  add column if not exists payment_status text not null default 'Unpaid',
  add column if not exists payment_reference text not null default '',
  add column if not exists payment_amount integer not null default 0,
  add column if not exists payment_currency text not null default 'NGN',
  add column if not exists payment_paid_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists passport_details jsonb not null default '{}'::jsonb;

alter table visa_applications
  alter column fee set default 'Basic visa package: visa fee included, admin processing fee included, Headies ticket fee included';

create unique index if not exists visa_applications_payment_reference_idx
  on visa_applications (payment_reference)
  where payment_reference <> '';

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'visa_applications_status_check'
      and conrelid = 'visa_applications'::regclass
  ) then
    alter table visa_applications drop constraint visa_applications_status_check;
  end if;

  alter table visa_applications
    add constraint visa_applications_status_check
    check (status in ('Draft', 'Submitted', 'In review', 'Missing documents', 'Approved', 'Declined'));

  update visa_applications
    set user_type = 'basic'
    where user_type is null or user_type = '';

  if exists (
    select 1 from pg_constraint
    where conname = 'visa_applications_user_type_check'
      and conrelid = 'visa_applications'::regclass
  ) then
    alter table visa_applications drop constraint visa_applications_user_type_check;
  end if;

  alter table visa_applications
    add constraint visa_applications_user_type_check
    check (user_type in ('basic', 'premium', 'staff', 'nominee'));

  if exists (
    select 1 from pg_constraint
    where conname = 'visa_applications_payment_status_check'
      and conrelid = 'visa_applications'::regclass
  ) then
    alter table visa_applications drop constraint visa_applications_payment_status_check;
  end if;

  alter table visa_applications
    add constraint visa_applications_payment_status_check
    check (payment_status in ('Unpaid', 'Pending', 'Paid', 'Failed'));
end $$;

create table if not exists visa_application_documents (
  id text primary key,
  application_id text not null references visa_applications(id) on delete cascade,
  field text not null default '',
  document text not null default '',
  required boolean not null default false,
  file_name text not null,
  file_size bigint not null default 0,
  file_type text not null default 'application/octet-stream',
  file_data bytea not null,
  created_at timestamptz not null default now()
);

create index if not exists visa_application_documents_application_idx
  on visa_application_documents (application_id);

create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into app_settings (key, value)
values
  ('visa_basic_fee_naira', '745000'),
  ('visa_premium_fee_naira', '745000'),
  ('visa_nominee_fee_naira', '350000')
on conflict (key) do nothing;

create table if not exists package_bookings (
  id text primary key,
  reference text not null unique,
  idempotency_key text not null unique,
  token_hash text not null,
  total_amount_kobo bigint not null check (total_amount_kobo > 0),
  payment_status text not null default 'Pending'
    check (payment_status in ('Unpaid', 'Pending', 'Paid', 'Failed')),
  fulfillment_status text not null default 'Awaiting payment'
    check (fulfillment_status in ('Awaiting payment', 'Payment received', 'Contacted', 'Confirmed', 'Cancelled')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists package_bookings_created_idx on package_bookings (created_at desc);
create index if not exists package_bookings_fulfillment_idx on package_bookings (fulfillment_status, updated_at desc);
