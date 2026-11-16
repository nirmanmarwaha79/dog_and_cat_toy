-- Run this entire script in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  parent_id uuid null references public.folders(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, parent_id, name)
);

create table if not exists public.files (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid null references public.folders(id) on delete set null,
  name text not null check (char_length(name) between 1 and 255),
  object_key text not null unique,
  size_bytes bigint not null check (size_bytes > 0),
  mime_type text,
  status text not null default 'pending' check (status in ('pending','complete')),
  created_at timestamptz not null default now()
);

create index if not exists folders_user_parent_idx on public.folders(user_id, parent_id);
create index if not exists files_user_folder_idx on public.files(user_id, folder_id);
create index if not exists files_user_created_idx on public.files(user_id, created_at desc);

alter table public.folders enable row level security;
alter table public.files enable row level security;

drop policy if exists "Users manage their own folders" on public.folders;
create policy "Users manage their own folders" on public.folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage their own files" on public.files;
create policy "Users manage their own files" on public.files
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Do not expose the R2 bucket publicly. All object access uses short-lived signed URLs.
