-- ALVZ Grade, phase vente : licences, commandes, activations (Postgres sur Supabase).
-- La phase perso n'utilise pas de base : l'état des clips est en JSON local.
-- Accès : RLS. Un client lit ses propres lignes ; toutes les écritures passent par
-- le serveur (clé de service : webhook Stripe, routes /api/license/*).

create extension if not exists pgcrypto;

-- Catalogue : le plugin, les looks, les effets.
create table products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  kind text not null check (kind in ('plugin', 'look', 'effect', 'lut_pack', 'bundle')),
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'eur' check (currency ~ '^[a-z]{3}$'),
  stripe_price_id text unique,
  -- empreinte du fichier livré : l'app vérifie un look importé par son contenu
  content_sha256 text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  -- null pour un achat sans compte : rattaché à la connexion par email
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  stripe_session_id text not null unique,
  status text not null default 'paid' check (status in ('paid', 'refunded', 'partially_refunded')),
  total_cents integer not null check (total_cents >= 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on orders (user_id);
create index on orders (lower(email));

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  -- restrict : on ne supprime pas un produit déjà vendu, on le désactive
  product_id uuid not null references products(id) on delete restrict,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  created_at timestamptz not null default now(),
  unique (order_id, product_id)
);
create index on order_items (product_id);

-- Une clé par client, comme l'original (« your licence key stays the same »).
create table licenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  -- seule l'empreinte est stockée ; la clé en clair part une fois par email
  key_hash text not null unique,
  max_activations integer not null default 2 check (max_activations between 1 and 10),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on licenses (user_id);
create unique index on licenses (lower(email));

-- Ce que la clé débloque.
create table entitlements (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references licenses(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  order_id uuid references orders(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (license_id, product_id)
);
create index on entitlements (product_id);
create index on entitlements (order_id);

create table activations (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references licenses(id) on delete cascade,
  machine_hash text not null,
  machine_label text,
  app_version text not null,
  last_seen_at timestamptz not null default now(),
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (license_id, machine_hash)
);
create index on activations (license_id) where deactivated_at is null;
create index on activations (last_seen_at);

-- Idempotence : Stripe peut envoyer le même événement deux fois.
create table stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

-- updated_at automatique
create function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger products_touch before update on products for each row execute function touch_updated_at();
create trigger orders_touch before update on orders for each row execute function touch_updated_at();
create trigger licenses_touch before update on licenses for each row execute function touch_updated_at();

-- Limite d'activations : vérifiée en base, pas seulement dans l'API (deux activations simultanées).
create function check_activation_limit() returns trigger language plpgsql as $$
declare n integer; lim integer;
begin
  select max_activations into lim from licenses where id = new.license_id for update;
  select count(*) into n from activations
    where license_id = new.license_id and deactivated_at is null and id <> new.id;
  if new.deactivated_at is null and n >= lim then
    raise exception 'activation limit reached' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger activations_limit before insert or update of deactivated_at on activations
  for each row execute function check_activation_limit();

-- RLS
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table licenses enable row level security;
alter table entitlements enable row level security;
alter table activations enable row level security;
alter table stripe_events enable row level security;  -- aucune policy : service uniquement

create policy products_public_read on products for select using (active);
create policy orders_own on orders for select using (user_id = auth.uid());
create policy order_items_own on order_items for select
  using (exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()));
create policy licenses_own on licenses for select using (user_id = auth.uid());
create policy entitlements_own on entitlements for select
  using (exists (select 1 from licenses l where l.id = license_id and l.user_id = auth.uid()));
create policy activations_own on activations for select
  using (exists (select 1 from licenses l where l.id = license_id and l.user_id = auth.uid()));
