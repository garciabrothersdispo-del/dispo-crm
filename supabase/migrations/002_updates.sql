-- ============================================================
-- DispoCRM Pro — Update Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Add description and due_time to tasks
alter table public.tasks add column if not exists description text;
alter table public.tasks add column if not exists due_time text;

-- Add counties to buyers
alter table public.buyers add column if not exists counties text;
