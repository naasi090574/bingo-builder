create table public.game_publications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  local_id text not null check (length(local_id) between 1 and 100),
  revision uuid,
  generation integer not null default 0,
  manifest jsonb,
  published boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (owner_id, local_id),
  check (not published or (revision is not null and manifest is not null))
);

alter table public.game_publications enable row level security;
revoke all on public.game_publications from public, anon, authenticated;
grant select, insert, update on public.game_publications to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('game-publications', 'game-publications', false, 50000000,
  array['image/png','image/jpeg','image/webp','image/gif','image/avif','image/svg+xml',
        'audio/mpeg','audio/wav','audio/ogg','audio/webm','audio/mp4','audio/flac','audio/aac','application/octet-stream']);
-- Also deny access if a broader permissive Storage policy exists elsewhere.
create policy "Bingo publication files require server authorization"
on storage.objects as restrictive for all to anon, authenticated
using (bucket_id <> 'game-publications')
with check (bucket_id <> 'game-publications');
