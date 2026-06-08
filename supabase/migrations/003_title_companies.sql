-- ============================================================
-- DispoCRM Pro — Title Companies Table
-- Run this in your Supabase SQL Editor
-- ============================================================

create table public.title_companies (
  id uuid default uuid_generate_v4() primary key,
  created_by uuid references public.profiles(id),
  name text not null,
  state text not null,
  counties_covered text,
  deals_done integer default 0,
  deal_types text[] default '{}',
  escrow_officer text,
  email text,
  phone text,
  hours_of_operation text,
  days_of_operation text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.title_companies enable row level security;
create policy "All authenticated users can view title companies" on public.title_companies for select using (auth.uid() is not null);
create policy "All authenticated users can insert title companies" on public.title_companies for insert with check (auth.uid() is not null);
create policy "All authenticated users can update title companies" on public.title_companies for update using (auth.uid() is not null);
create policy "Admins can delete title companies" on public.title_companies for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

create trigger title_companies_updated_at before update on public.title_companies for each row execute procedure public.set_updated_at();

alter publication supabase_realtime add table public.title_companies;
