-- FastLane: run this once in Supabase, SQL Editor, New query, Run.
-- Safe to run again: it replaces its own rules without touching your data.

-- 1. One table holds every record (applications, claims, users...)
create table if not exists public.records (
  collection text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);
create index if not exists records_updated_idx on public.records (updated_at);

-- 2. Only accept the kinds of record the app uses, and cap their size
alter table public.records drop constraint if exists records_collection_ok;
alter table public.records add constraint records_collection_ok check (
  collection in ('users','lto','vig','quotes','apps','policies','payments',
                 'claims','notifs','audit','sessions','notes','settings'));
alter table public.records drop constraint if exists records_size_ok;
alter table public.records add constraint records_size_ok check (
  length(id) <= 120 and octet_length(data::text) <= 200000);

-- 3. Keep updated_at fresh so other computers can ask "what changed?"
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists records_touch on public.records;
create trigger records_touch before update on public.records
  for each row execute function public.touch_updated_at();

-- 4. Access rules. PROTOTYPE: anyone with the site's public key can read, add and change records.
--    There is deliberately NO delete permission, so records cannot be wiped through the API
--    (the app "deletes" by marking a record as deleted). Use fictitious data only.
alter table public.records enable row level security;
drop policy if exists "prototype open access" on public.records;
drop policy if exists "prototype read" on public.records;
drop policy if exists "prototype insert" on public.records;
drop policy if exists "prototype update" on public.records;
create policy "prototype read" on public.records for select to anon using (true);
create policy "prototype insert" on public.records for insert to anon with check (true);
create policy "prototype update" on public.records for update to anon using (true) with check (true);
revoke all on public.records from anon;
grant usage on schema public to anon;
grant select, insert, update on public.records to anon;

-- 5. Storage bucket for uploaded documents: private, images and PDFs only, 5 MB per file, no delete
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('documents', 'documents', false, 5242880,
          array['image/jpeg','image/png','application/pdf'])
  on conflict (id) do update set
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "prototype documents read" on storage.objects;
drop policy if exists "prototype documents insert" on storage.objects;
drop policy if exists "prototype documents update" on storage.objects;
create policy "prototype documents read" on storage.objects
  for select to anon using (bucket_id = 'documents');
create policy "prototype documents insert" on storage.objects
  for insert to anon with check (bucket_id = 'documents');
create policy "prototype documents update" on storage.objects
  for update to anon using (bucket_id = 'documents') with check (bucket_id = 'documents');
