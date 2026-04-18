-- Script consolidado para Supabase.
-- Crea/ajusta tablas, constraints, helpers y policies RLS sin usar
-- subconsultas recursivas sobre profiles.

create extension if not exists pgcrypto;

-- =========================================================
-- TABLAS BASE
-- =========================================================

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text,
    email text,
    role text not null default 'buyer',
    status text not null default 'active',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.propiedades (
    id uuid primary key default gen_random_uuid(),
    titulo text not null,
    precio numeric(12,2) not null,
    tipo text not null default 'venta',
    habitaciones integer not null default 1,
    banos integer not null default 1,
    ubicacion text not null,
    descripcion text not null default '',
    imagen_url text not null default '',
    owner_id uuid references public.profiles(id) on delete set null,
    status text not null default 'borrador',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.contactos (
    id uuid primary key default gen_random_uuid(),
    nombre text not null,
    email text not null,
    telefono text not null,
    mensaje text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.favorites (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    property_id uuid not null references public.propiedades(id) on delete cascade,
    created_at timestamptz not null default now()
);

-- =========================================================
-- MIGRACIONES SEGURAS
-- =========================================================

alter table if exists public.profiles
    add column if not exists email text;

alter table if exists public.profiles
    add column if not exists role text not null default 'buyer';

alter table if exists public.profiles
    add column if not exists status text not null default 'active';

alter table if exists public.profiles
    add column if not exists created_at timestamptz not null default now();

alter table if exists public.profiles
    add column if not exists updated_at timestamptz not null default now();

alter table if exists public.propiedades
    add column if not exists owner_id uuid references public.profiles(id) on delete set null;

alter table if exists public.propiedades
    add column if not exists status text not null default 'borrador';

alter table if exists public.propiedades
    add column if not exists created_at timestamptz not null default now();

alter table if exists public.propiedades
    add column if not exists updated_at timestamptz not null default now();

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'propiedades'
          and column_name = 'tipo'
    ) then
        update public.propiedades
        set tipo = 'renta'
        where tipo = 'alquiler';
    end if;
end $$;

update public.profiles
set status = coalesce(status, 'active')
where status is null;

update public.profiles
set role = coalesce(role, 'buyer')
where role is null;

update public.propiedades
set status = coalesce(status, 'publicada')
where status is null;

alter table public.profiles
    drop constraint if exists profiles_role_check;

alter table public.profiles
    add constraint profiles_role_check
    check (role in ('admin', 'seller', 'buyer'));

alter table public.profiles
    drop constraint if exists profiles_status_check;

alter table public.profiles
    add constraint profiles_status_check
    check (status in ('active', 'inactive'));

alter table public.propiedades
    drop constraint if exists propiedades_tipo_check;

alter table public.propiedades
    add constraint propiedades_tipo_check
    check (tipo in ('venta', 'renta'));

alter table public.propiedades
    drop constraint if exists propiedades_status_check;

alter table public.propiedades
    add constraint propiedades_status_check
    check (status in ('borrador', 'publicada', 'vendida', 'archivada'));

create unique index if not exists idx_favorites_user_property_unique
    on public.favorites(user_id, property_id);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_status on public.profiles(status);
create index if not exists idx_propiedades_owner_id on public.propiedades(owner_id);
create index if not exists idx_propiedades_status on public.propiedades(status);
create index if not exists idx_propiedades_created_at on public.propiedades(created_at desc);
create index if not exists idx_contactos_created_at on public.contactos(created_at desc);
create index if not exists idx_favorites_user_id on public.favorites(user_id);
create index if not exists idx_favorites_property_id on public.favorites(property_id);

-- =========================================================
-- UPDATED_AT
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_propiedades_updated_at on public.propiedades;
create trigger set_propiedades_updated_at
before update on public.propiedades
for each row
execute function public.set_updated_at();

-- =========================================================
-- HELPERS RLS SIN RECURSION
-- =========================================================

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select role
    from public.profiles
    where id = auth.uid()
    limit 1;
$$;

create or replace function public.current_profile_status()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select status
    from public.profiles
    where id = auth.uid()
    limit 1;
$$;

-- =========================================================
-- RLS
-- =========================================================

alter table if exists public.profiles enable row level security;
alter table if exists public.propiedades enable row level security;
alter table if exists public.contactos enable row level security;
alter table if exists public.favorites enable row level security;

-- Elimina todas las policies existentes de estas tablas para evitar
-- que una policy vieja siga viva con otro nombre.
do $$
declare
    policy_name text;
begin
    for policy_name in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = 'profiles'
    loop
        execute format('drop policy if exists %I on public.profiles', policy_name);
    end loop;

    for policy_name in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = 'propiedades'
    loop
        execute format('drop policy if exists %I on public.propiedades', policy_name);
    end loop;

    for policy_name in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = 'contactos'
    loop
        execute format('drop policy if exists %I on public.contactos', policy_name);
    end loop;

    for policy_name in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = 'favorites'
    loop
        execute format('drop policy if exists %I on public.favorites', policy_name);
    end loop;
end $$;

-- Elimina policies nuevas conocidas
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "propiedades_public_read" on public.propiedades;
drop policy if exists "propiedades_admin_full_access" on public.propiedades;
drop policy if exists "propiedades_seller_insert_own" on public.propiedades;
drop policy if exists "propiedades_seller_update_own" on public.propiedades;
drop policy if exists "contactos_public_insert" on public.contactos;
drop policy if exists "contactos_admin_read" on public.contactos;
drop policy if exists "favorites_select_own" on public.favorites;
drop policy if exists "favorites_insert_own" on public.favorites;
drop policy if exists "favorites_delete_own" on public.favorites;

-- Elimina policies viejas conocidas para evitar conflictos
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "propiedades_public_read"
on public.propiedades
for select
to anon, authenticated
using (
    status = 'publicada'
    or public.current_profile_role() = 'admin'
    or (
        public.current_profile_role() = 'seller'
        and public.current_profile_status() = 'active'
        and owner_id = auth.uid()
    )
);

create policy "propiedades_admin_full_access"
on public.propiedades
for all
to authenticated
using (
    public.current_profile_role() = 'admin'
    and public.current_profile_status() = 'active'
)
with check (
    public.current_profile_role() = 'admin'
    and public.current_profile_status() = 'active'
);

create policy "propiedades_seller_insert_own"
on public.propiedades
for insert
to authenticated
with check (
    public.current_profile_role() = 'seller'
    and public.current_profile_status() = 'active'
    and owner_id = auth.uid()
    and status in ('borrador', 'publicada')
);

create policy "propiedades_seller_update_own"
on public.propiedades
for update
to authenticated
using (
    public.current_profile_role() = 'seller'
    and public.current_profile_status() = 'active'
    and owner_id = auth.uid()
)
with check (
    public.current_profile_role() = 'seller'
    and public.current_profile_status() = 'active'
    and owner_id = auth.uid()
    and status in ('borrador', 'publicada', 'archivada')
);

create policy "contactos_public_insert"
on public.contactos
for insert
to anon, authenticated
with check (true);

create policy "contactos_admin_read"
on public.contactos
for select
to authenticated
using (
    public.current_profile_role() = 'admin'
    and public.current_profile_status() = 'active'
);

create policy "favorites_select_own"
on public.favorites
for select
to authenticated
using (user_id = auth.uid());

create policy "favorites_insert_own"
on public.favorites
for insert
to authenticated
with check (user_id = auth.uid());

create policy "favorites_delete_own"
on public.favorites
for delete
to authenticated
using (user_id = auth.uid());

-- =========================================================
-- NOTAS
-- =========================================================
-- 1. Si ya tienes usuarios en auth y algunos no existen en profiles,
--    crea sus perfiles manualmente o agrega un trigger de sincronizacion.
-- 2. No se habilita DELETE sobre profiles para clientes normales.
--    Si quieres borrado administrativo, hazlo desde backend con service role.
-- 3. Seller no puede borrar propiedades por RLS; solo puede actualizarlas
--    y dejarlas en estado archivada.
