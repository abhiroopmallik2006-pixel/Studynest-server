-- StudyNest migration: custom folders inside subjects
-- Run once in the Supabase SQL Editor for the project used by Render.

create table if not exists public.studynest_folders (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.studynest_users(id) on delete cascade,
  subject_id bigint not null references public.studynest_subjects(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (user_id, subject_id, name)
);

alter table public.studynest_folders enable row level security;

alter table public.studynest_resources
  add column if not exists folder_id bigint
  references public.studynest_folders(id) on delete set null;

create index if not exists studynest_folders_subject_idx
  on public.studynest_folders(subject_id);

create index if not exists studynest_resources_folder_idx
  on public.studynest_resources(folder_id);
