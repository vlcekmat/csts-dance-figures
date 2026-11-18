-- Routine sync for the ČSTS figure catalog. Run once in the Supabase SQL editor.
-- One row per user: their routines, own figures and deletions (tombstones), as JSON.
create table if not exists public.user_data (
  user_id uuid primary key references auth.users on delete cascade default auth.uid(),
  routines jsonb not null default '[]',
  custom_figures jsonb not null default '[]',
  deleted jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists "own row" on public.user_data;
create policy "own row" on public.user_data
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
