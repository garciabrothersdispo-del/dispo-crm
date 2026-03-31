-- ============================================================
-- DispoCRM Pro — Supabase Database Schema
-- Run this in your Supabase SQL Editor (Database > SQL Editor)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── PROFILES (extends Supabase auth.users) ───────────────────
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  role text not null default 'agent' check (role in ('admin', 'agent')),
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view all profiles in their org"
  on public.profiles for select using (auth.uid() is not null);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── BUYERS ────────────────────────────────────────────────────
create table public.buyers (
  id uuid default uuid_generate_v4() primary key,
  created_by uuid references public.profiles(id),
  first_name text not null,
  last_name text,
  phone text,
  email text,
  company text,
  rank text not null default 'Unqualified' check (rank in ('VIP', 'Qualified', 'Unqualified')),
  buyer_type text,
  price_range text,
  city text,
  zip_codes text,
  close_timeline text,
  proof_of_funds text default 'Not Verified',
  tags text[] default '{}',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.buyers enable row level security;
create policy "All authenticated users can view buyers" on public.buyers for select using (auth.uid() is not null);
create policy "All authenticated users can insert buyers" on public.buyers for insert with check (auth.uid() is not null);
create policy "All authenticated users can update buyers" on public.buyers for update using (auth.uid() is not null);
create policy "Admins can delete buyers" on public.buyers for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- ─── DEALS ─────────────────────────────────────────────────────
create table public.deals (
  id uuid default uuid_generate_v4() primary key,
  created_by uuid references public.profiles(id),
  assigned_to uuid references public.profiles(id),

  -- Identity
  address text not null,
  pipeline text not null default 'general',
  stage text not null,

  -- Transaction
  tx_type text default 'Wholesale Assignment',
  asking_price text,
  contract_amount text,
  projected_profit text,
  assigned_for text,
  closed_for text,
  closing_date date,
  inspection_days integer,
  title_company text,

  -- Seller
  seller_name text,
  seller_phone text,
  seller_email text,
  seller_available_hours text,
  tc_seller_day text,
  tc_seller_time text,

  -- Buyer
  buyer_name text,
  buyer_phone text,
  buyer_email text,
  buyer_realtor text,
  realtor_email text,
  realtor_phone text,
  tc_buyer_day text,
  tc_buyer_time text,
  tc_title_day text,
  tc_title_time text,

  -- KPIs
  kpi_dials integer default 0,
  kpi_talk_time integer default 0,
  kpi_new_buyers integer default 0,
  kpi_offers integer default 0,
  kpi_walkthroughs integer default 0,

  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.deals enable row level security;
create policy "All authenticated users can view deals" on public.deals for select using (auth.uid() is not null);
create policy "All authenticated users can insert deals" on public.deals for insert with check (auth.uid() is not null);
create policy "All authenticated users can update deals" on public.deals for update using (auth.uid() is not null);
create policy "Admins can delete deals" on public.deals for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- ─── TASKS ─────────────────────────────────────────────────────
create table public.tasks (
  id uuid default uuid_generate_v4() primary key,
  deal_id uuid references public.deals(id) on delete cascade not null,
  stage text not null,
  text text not null,
  done boolean default false,
  deadline date,
  auto_generated boolean default false,
  completed_by uuid references public.profiles(id),
  completed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.tasks enable row level security;
create policy "All authenticated users can manage tasks" on public.tasks for all using (auth.uid() is not null);

-- ─── DEAL NOTES ────────────────────────────────────────────────
create table public.deal_notes (
  id uuid default uuid_generate_v4() primary key,
  deal_id uuid references public.deals(id) on delete cascade not null,
  author_id uuid references public.profiles(id),
  text text not null,
  created_at timestamptz default now()
);

alter table public.deal_notes enable row level security;
create policy "All authenticated users can manage deal notes" on public.deal_notes for all using (auth.uid() is not null);

-- ─── DEAL BUYERS (junction) ────────────────────────────────────
create table public.deal_buyers (
  deal_id uuid references public.deals(id) on delete cascade,
  buyer_id uuid references public.buyers(id) on delete cascade,
  primary key (deal_id, buyer_id)
);

alter table public.deal_buyers enable row level security;
create policy "All authenticated users can manage deal_buyers" on public.deal_buyers for all using (auth.uid() is not null);

-- ─── ACTIVITY LOG ──────────────────────────────────────────────
create table public.activity_log (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  entity_label text,
  meta jsonb,
  created_at timestamptz default now()
);

alter table public.activity_log enable row level security;
create policy "All authenticated users can view activity" on public.activity_log for select using (auth.uid() is not null);
create policy "All authenticated users can insert activity" on public.activity_log for insert with check (auth.uid() = user_id);

-- ─── UPDATED_AT TRIGGERS ───────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger deals_updated_at before update on public.deals for each row execute procedure public.set_updated_at();
create trigger buyers_updated_at before update on public.buyers for each row execute procedure public.set_updated_at();

-- ─── REALTIME ──────────────────────────────────────────────────
alter publication supabase_realtime add table public.deals;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.deal_notes;
alter publication supabase_realtime add table public.buyers;
alter publication supabase_realtime add table public.activity_log;
