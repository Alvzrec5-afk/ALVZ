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
  color_follow_device boolean not null default true, -- suit le mode clair/sombre de l'appareil
  grid_style text not null default 'justified' check (grid_style in ('justified','square','columns')),
  grid_size text not null default 'large' check (grid_size in ('small','large')),
  grid_spacing text not null default 'fine' check (grid_spacing in ('fine','wide')),
  favorites_enabled boolean not null default true,
  download_web_enabled boolean not null default false,
  design jsonb not null default '{}'::jsonb, -- réglages de design validés par l'application
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
  select t.gallery_id, sum(t.bytes)::bigint
  from (
    select p.gallery_id, p.size_bytes + case when p.variants_bytes > 0 then p.variants_bytes else 1000000 end as bytes
    from public.photos p
    union all
    select v.gallery_id, v.size_bytes + v.extra_bytes
    from public.videos v
  ) t
  group by t.gallery_id;
$$;
revoke execute on function public.storage_usage() from public, anon;
grant execute on function public.storage_usage() to authenticated;

-- Journal des téléchargements (photo HD / taille web / ZIP).
create table public.downloads (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  photo_id uuid references public.photos(id) on delete set null,
  collection_id uuid references public.collections(id) on delete set null,
  kind text not null check (kind in ('photo', 'zip')),
  size text not null default 'hd' check (size in ('hd', 'web')),
  photo_count integer not null default 1,
  email text,
  created_at timestamptz not null default now()
);
create index downloads_gallery_idx on public.downloads (gallery_id, created_at desc);
create index downloads_photo_idx on public.downloads (photo_id);
create index downloads_collection_idx on public.downloads (collection_id);
alter table public.downloads enable row level security;
create policy "admin full access" on public.downloads
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- Réglages du studio (une seule ligne) : coordonnées affichées dans les galeries.
create table public.studio_settings (
  id integer primary key default 1 check (id = 1),
  contact jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.studio_settings (id) values (1);
alter table public.studio_settings enable row level security;
create policy "admin full access" on public.studio_settings
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- E-mails aux clients : désinscriptions et historique des envois.
create table public.mail_unsubscribes (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.mail_unsubscribes enable row level security;
create policy "admin full access" on public.mail_unsubscribes
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create table public.mail_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  recipients integer not null default 0,
  sent integer not null default 0,
  failed integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.mail_campaigns enable row level security;
create policy "admin full access" on public.mail_campaigns
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- Type de galerie : photos (Galeries) ou projet vidéo (espace Vidéos du studio).
alter table public.galleries add column kind text not null default 'photo' check (kind in ('photo', 'video'));

-- Vidéos : original + versions 1080p / 720p / 480p préparées dans le navigateur.
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  title text not null,
  filename text not null,
  original_ext text not null,
  original_type text not null default 'video/mp4',
  size_bytes bigint not null default 0,
  extra_bytes bigint not null default 0,       -- versions + image d'aperçu
  renditions jsonb not null default '[]'::jsonb, -- [{ "h": 720, "w": 1280, "bytes": 123 }]
  duration real not null default 0,
  width integer not null default 0,
  height integer not null default 0,
  watermarked boolean not null default false,  -- filigrane incrusté dans les versions
  downloads_enabled boolean not null default true,
  status text not null default 'uploading' check (status in ('uploading', 'ready')),
  multipart_upload_id text,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);
create index videos_gallery_idx on public.videos (gallery_id, position);
alter table public.videos enable row level security;
create policy "admin full access" on public.videos
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- Commentaires des clients sur la timeline (prénom seulement, pas d'e-mail).
create table public.video_comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  time_sec real not null default 0,
  author text not null,
  body text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index video_comments_video_idx on public.video_comments (video_id, time_sec);
alter table public.video_comments enable row level security;
create policy "admin full access" on public.video_comments
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- Activité anonyme : lectures (avec la part regardée) et téléchargements.
create table public.video_events (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  kind text not null check (kind in ('view', 'download')),
  watched_pct smallint not null default 0,
  quality text,
  created_at timestamptz not null default now()
);
create index video_events_video_idx on public.video_events (video_id, created_at desc);
alter table public.video_events enable row level security;
create policy "admin full access" on public.video_events
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- Tableaux (façon Milanote) : moodboards, listes de plans, préparation de tournage.
-- Reliés ou non à une galerie ; partage client par lien secret.
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  gallery_id uuid references public.galleries(id) on delete set null,
  share_slug text not null unique,
  share_enabled boolean not null default false,
  client_can_add boolean not null default true,   -- le client peut ajouter ses notes, images et listes
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index boards_gallery_idx on public.boards (gallery_id);
alter table public.boards enable row level security;
create policy "admin full access" on public.boards
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- Cartes : note, image, liste à cocher, colonne, flèche (data.from → data.to).
-- Une carte rangée dans une colonne a parent_id = la colonne et position = son rang.
create table public.board_items (
  id uuid primary key,
  board_id uuid not null references public.boards(id) on delete cascade,
  kind text not null check (kind in ('note', 'image', 'todo', 'column', 'arrow')),
  x real not null default 0,
  y real not null default 0,
  w real not null default 240,
  z double precision not null default 0,
  parent_id uuid references public.board_items(id) on delete set null,
  position double precision not null default 0,
  data jsonb not null default '{}'::jsonb,
  size_bytes bigint not null default 0,          -- image stockée sur Oracle
  author text,                                   -- prénom du client ; null = studio
  client_id text,                                -- visiteur qui a créé la carte (cookie signé)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index board_items_board_idx on public.board_items (board_id);
create index board_items_parent_idx on public.board_items (parent_id);
alter table public.board_items enable row level security;
create policy "admin full access" on public.board_items
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- Le stockage compte aussi les images des tableaux.
create or replace function public.storage_usage()
returns table (gallery_id uuid, bytes bigint)
language sql stable security invoker set search_path = '' as $$
  select t.gallery_id, sum(t.bytes)::bigint
  from (
    select p.gallery_id, p.size_bytes + case when p.variants_bytes > 0 then p.variants_bytes else 1000000 end as bytes
    from public.photos p
    union all
    select v.gallery_id, v.size_bytes + v.extra_bytes
    from public.videos v
    union all
    select b.gallery_id, i.size_bytes
    from public.board_items i join public.boards b on b.id = i.board_id
    where i.size_bytes > 0
  ) t
  group by t.gallery_id;
$$;

-- Sous-tableaux (une carte « Tableau » ouvre un tableau rangé dedans), cartes couleur et lien.
alter table public.boards add column parent_id uuid references public.boards(id) on delete cascade;
create index boards_parent_idx on public.boards (parent_id);
alter table public.board_items drop constraint board_items_kind_check;
alter table public.board_items add constraint board_items_kind_check
  check (kind in ('note', 'image', 'todo', 'column', 'arrow', 'board', 'color', 'link'));
create index board_items_board_ref_idx on public.board_items ((data->>'boardId')) where kind = 'board';

-- Cartes « tableau » (grille de cellules, comme le Tableau de Milanote).
alter table public.board_items drop constraint board_items_kind_check;
alter table public.board_items add constraint board_items_kind_check
  check (kind in ('note', 'image', 'todo', 'column', 'arrow', 'board', 'color', 'link', 'table'));

-- Commentaires (carte « Commentaire ») et option « le client peut tout modifier ».
alter table public.boards add column client_can_edit boolean not null default false;
alter table public.board_items drop constraint board_items_kind_check;
alter table public.board_items add constraint board_items_kind_check
  check (kind in ('note', 'image', 'todo', 'column', 'arrow', 'board', 'color', 'link', 'table', 'comment'));
create table public.board_comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.board_items(id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete cascade,
  author text not null,                 -- prénom du client, ou « ALVZ.REC » pour le studio
  is_studio boolean not null default false,
  client_id text,                       -- visiteur qui a écrit (pour qu'il puisse effacer son message)
  body text not null,
  created_at timestamptz not null default now()
);
create index board_comments_item_idx on public.board_comments (item_id, created_at);
create index board_comments_board_idx on public.board_comments (board_id);
alter table public.board_comments enable row level security;
create policy "admin full access" on public.board_comments
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- Corbeille : galeries, projets vidéo et tableaux supprimés restent récupérables 30 jours.
-- Cartes d'un tableau : effacées pour de bon 24 h après (Cmd + Z peut les faire revenir avant).
alter table public.galleries add column deleted_at timestamptz;
alter table public.boards add column deleted_at timestamptz;
alter table public.board_items add column deleted_at timestamptz;
create index galleries_deleted_idx on public.galleries (deleted_at) where deleted_at is not null;
create index boards_deleted_idx on public.boards (deleted_at) where deleted_at is not null;
create index board_items_deleted_idx on public.board_items (board_id, deleted_at) where deleted_at is not null;

-- Modèle des nouveaux tableaux : un tableau spécial que le studio modifie ; chaque nouveau tableau en est une copie.
alter table public.boards add column is_template boolean not null default false;

-- Banque d'images : un tableau à part dont les images sont proposées dans « Images projet » de tous les tableaux.
alter table public.boards add column is_library boolean not null default false;

-- Couverture choisie pour un tableau (vignette de la liste des tableaux).
alter table public.boards add column cover_key text;
alter table public.boards add column cover_size bigint not null default 0;
create or replace function public.storage_usage()
returns table (gallery_id uuid, bytes bigint)
language sql stable security invoker set search_path = '' as $$
  select t.gallery_id, sum(t.bytes)::bigint
  from (
    select p.gallery_id, p.size_bytes + case when p.variants_bytes > 0 then p.variants_bytes else 1000000 end as bytes
    from public.photos p
    union all
    select v.gallery_id, v.size_bytes + v.extra_bytes
    from public.videos v
    union all
    select b.gallery_id, i.size_bytes
    from public.board_items i join public.boards b on b.id = i.board_id
    where i.size_bytes > 0
    union all
    select b.gallery_id, b.cover_size from public.boards b where b.cover_size > 0
  ) t
  group by t.gallery_id;
$$;

-- Téléchargement : demander l'e-mail du client avant (pour récupérer les adresses).
alter table public.galleries add column if not exists download_email_required boolean not null default false;

-- Téléchargements vidéo : e-mail du visiteur (s'il l'a indiqué).
alter table public.video_events add column if not exists email text;

-- Toute modification d'une carte date son tableau (une seule écriture par transaction) :
-- évite un aller-retour à chaque enregistrement et sert de « version » au rafraîchissement.
create or replace function private.touch_board() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.boards set updated_at = now()
  where id = coalesce(new.board_id, old.board_id) and updated_at < now();
  return null;
end $$;
create trigger board_items_touch_board
  after insert or update or delete on public.board_items
  for each row execute function private.touch_board();

-- Chemin d'un tableau jusqu'au tableau principal, et un tableau avec toutes ses planches : une requête au lieu d'une par niveau.
create or replace function public.board_path(target uuid)
returns setof public.boards
language sql stable security invoker set search_path = ''
as $$
  with recursive up(id, depth) as (
    select target, 0
    union all
    select b.parent_id, up.depth + 1 from public.boards b join up on b.id = up.id
    where b.parent_id is not null and up.depth < 25
  )
  select b.* from up join public.boards b on b.id = up.id order by up.depth desc;
$$;
create or replace function public.board_tree(root uuid)
returns table (id uuid, title text)
language sql stable security invoker set search_path = ''
as $$
  with recursive down(id, title, depth) as (
    select b.id, b.title, 0 from public.boards b where b.id = root and b.deleted_at is null
    union all
    select b.id, b.title, down.depth + 1 from public.boards b join down on b.parent_id = down.id
    where b.deleted_at is null and down.depth < 25
  )
  select down.id, down.title from down order by down.depth limit 500;
$$;
revoke execute on function public.board_path(uuid) from public, anon;
revoke execute on function public.board_tree(uuid) from public, anon;
grant execute on function public.board_path(uuid) to authenticated, service_role;
grant execute on function public.board_tree(uuid) to authenticated, service_role;

-- Accueil du studio : tous les chiffres en une requête (comptes et espace par catégorie ; somme = storage_usage()).
-- Texte complet de la fonction : voir la migration « studio_overview » (catégories : photos, vidéos, tableaux, banque d'images).
