-- Schéma de référence (déjà appliqué au projet Supabase ayootztgiuhpqgeckwfu).
-- Garde une trace de la structure ; à réappliquer seulement sur un projet neuf.

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create schema if not exists private;
grant usage on schema private to authenticated;
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

create table public.galleries (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  event_date date,
  cover_photo_id uuid,
  password_hash text,
  expires_at timestamptz,
  watermark boolean not null default false,
  downloads_enabled boolean not null default true,
  theme text not null default 'light' check (theme in ('light','dark')), -- ancien réglage, remplacé par color_theme
  cover_layout text not null default 'center' check (cover_layout in ('center','bottom','split','framed')),
  cover_focus_x real not null default 50 check (cover_focus_x between 0 and 100),
  cover_focus_y real not null default 50 check (cover_focus_y between 0 and 100),
  font_style text not null default 'classic' check (font_style in ('classic','modern','editorial','minimal')),
  color_theme text not null default 'noir' check (color_theme in ('noir','blanc','sable','anthracite')),
  grid_style text not null default 'justified' check (grid_style in ('justified','square','columns')),
  grid_size text not null default 'large' check (grid_size in ('small','large')),
  grid_spacing text not null default 'fine' check (grid_spacing in ('fine','wide')),
  favorites_enabled boolean not null default true,
  download_web_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (gallery_id, name)
);
create index collections_gallery_idx on public.collections (gallery_id, position);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  filename text not null,
  content_hash text not null,
  original_ext text not null default 'jpg',
  original_type text not null default 'image/jpeg',
  size_bytes bigint not null default 0,
  width integer not null default 0,
  height integer not null default 0,
  taken_at timestamptz,
  position double precision not null default 0,
  status text not null default 'uploading' check (status in ('uploading', 'ready')),
  multipart_upload_id text,
  variants_bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (gallery_id, content_hash)
);
create index photos_collection_idx on public.photos (collection_id, position);
create index photos_gallery_idx on public.photos (gallery_id);

alter table public.galleries add constraint galleries_cover_fk
  foreign key (cover_photo_id) references public.photos(id) on delete set null;
create index galleries_cover_idx on public.galleries (cover_photo_id);

create table public.favorite_lists (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  unique (gallery_id, email)
);

create table public.favorites (
  list_id uuid not null references public.favorite_lists(id) on delete cascade,
  photo_id uuid not null references public.photos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, photo_id)
);
create index favorites_photo_idx on public.favorites (photo_id);

-- RLS : activé partout ; aucun accès pour les visiteurs anonymes.
alter table public.admins enable row level security;
alter table public.galleries enable row level security;
alter table public.collections enable row level security;
alter table public.photos enable row level security;
alter table public.favorite_lists enable row level security;
alter table public.favorites enable row level security;

create policy "admin reads own row" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));
create policy "admin full access" on public.galleries
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin full access" on public.collections
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin full access" on public.photos
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin full access" on public.favorite_lists
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin full access" on public.favorites
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- Espace utilisé par galerie (soumis aux règles RLS : seul l'admin obtient un résultat).
create or replace function public.storage_usage()
returns table (gallery_id uuid, bytes bigint)
language sql stable security invoker set search_path = '' as $$
  select p.gallery_id,
         sum(p.size_bytes + case when p.variants_bytes > 0 then p.variants_bytes else 1000000 end)::bigint
  from public.photos p
  group by p.gallery_id;
$$;
revoke execute on function public.storage_usage() from public, anon;
grant execute on function public.storage_usage() to authenticated;
