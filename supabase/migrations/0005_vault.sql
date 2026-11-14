-- 0005_vault.sql
-- Moves API keys from browser-side encryption to Supabase Vault, and adds a daily call limit.
-- Keys are written and read only by the Edge Functions (service_role); the app never sees a full key.

create extension if not exists supabase_vault with schema vault;

-- The browser-encrypted blob is replaced by Vault.
drop table if exists public.user_secrets;

-- ---------------------------------------------------------------- key metadata

-- Holds everything about a key except the key itself, which lives in vault.secrets.
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('gemini', 'openai', 'claude', 'tmdb')),
  label text check (char_length(label) <= 60),
  models text[] not null default '{}',   -- tried in this order; empty for tmdb
  sort_order integer not null,           -- fallback order across keys, lowest first
  hint text,                             -- last 4 characters, so a key can be recognised
  vault_secret_id uuid not null,
  created_at timestamptz not null default now()
);
create index api_keys_user_idx on public.api_keys (user_id, sort_order);

alter table public.api_keys enable row level security;
-- Read-only on purpose: with no insert, update or delete policy, only the Edge Functions can change keys.
create policy "owner can read" on public.api_keys for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.api_keys from anon;
revoke insert, update, delete on public.api_keys from authenticated;

-- ---------------------------------------------------------------- daily call limit

create table public.usage_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  fn text not null,
  calls integer not null default 0,
  primary key (user_id, day, fn)
);

alter table public.usage_counters enable row level security;
create policy "owner can read" on public.usage_counters for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.usage_counters from anon;
revoke insert, update, delete on public.usage_counters from authenticated;

-- ---------------------------------------------------------------- functions (service_role only)

-- Counts one call and reports whether it is still within the daily limit.
create function public.app_bump_usage(p_user uuid, p_fn text, p_limit integer)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_calls integer;
begin
  insert into usage_counters (user_id, day, fn, calls) values (p_user, current_date, p_fn, 1)
  on conflict (user_id, day, fn) do update set calls = usage_counters.calls + 1
  returning calls into v_calls;

  delete from usage_counters where day < current_date - 30;
  return v_calls <= p_limit;
end $$;

-- Stores the secret in Vault and records its metadata in one step.
create function public.app_add_api_key(
  p_user uuid, p_provider text, p_label text, p_models text[], p_secret text
) returns uuid
language plpgsql security definer set search_path = public, vault as $$
declare
  v_secret uuid;
  v_id uuid;
  v_order integer;
begin
  if (select count(*) from api_keys where user_id = p_user) >= 20 then
    raise exception 'Too many keys saved (limit 20).';
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_order from api_keys where user_id = p_user;
  v_secret := vault.create_secret(p_secret, 'api_key_' || gen_random_uuid()::text, 'Filme ' || p_provider || ' key');

  insert into api_keys (user_id, provider, label, models, sort_order, hint, vault_secret_id)
  values (p_user, p_provider, p_label, p_models, v_order, right(p_secret, 4), v_secret)
  returning id into v_id;

  return v_id;
end $$;

create function public.app_remove_api_key(p_user uuid, p_id uuid)
returns void
language plpgsql security definer set search_path = public, vault as $$
declare
  v_secret uuid;
begin
  select vault_secret_id into v_secret from api_keys where id = p_id and user_id = p_user;
  if v_secret is null then
    return;
  end if;
  delete from api_keys where id = p_id and user_id = p_user;
  delete from vault.secrets where id = v_secret;
end $$;

-- Rewrites the fallback order to match the given list of key ids.
create function public.app_reorder_api_keys(p_user uuid, p_ids uuid[])
returns void
language sql security definer set search_path = public as $$
  update api_keys k set sort_order = o.ord
  from unnest(p_ids) with ordinality as o (id, ord)
  where k.id = o.id and k.user_id = p_user;
$$;

-- Returns decrypted keys in fallback order; p_id narrows it to a single key.
create function public.app_get_api_secrets(p_user uuid, p_providers text[], p_id uuid default null)
returns table (id uuid, provider text, label text, models text[], key_order integer, secret text)
language sql security definer set search_path = public, vault as $$
  select k.id, k.provider, k.label, k.models, k.sort_order, s.decrypted_secret
  from api_keys k
  join vault.decrypted_secrets s on s.id = k.vault_secret_id
  where k.user_id = p_user
    and k.provider = any (p_providers)
    and (p_id is null or k.id = p_id)
  order by k.sort_order;
$$;

-- Postgres grants new functions to everyone by default; lock these to the Edge Functions' role.
revoke all on function public.app_bump_usage(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.app_add_api_key(uuid, text, text, text[], text) from public, anon, authenticated;
revoke all on function public.app_remove_api_key(uuid, uuid) from public, anon, authenticated;
revoke all on function public.app_reorder_api_keys(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.app_get_api_secrets(uuid, text[], uuid) from public, anon, authenticated;

grant execute on function public.app_bump_usage(uuid, text, integer) to service_role;
grant execute on function public.app_add_api_key(uuid, text, text, text[], text) to service_role;
grant execute on function public.app_remove_api_key(uuid, uuid) to service_role;
grant execute on function public.app_reorder_api_keys(uuid, uuid[]) to service_role;
grant execute on function public.app_get_api_secrets(uuid, text[], uuid) to service_role;
