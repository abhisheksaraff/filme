-- 0006_models.sql
-- Models now belong to a provider, not to a single key, and the provider order is its own list.
-- Like api_keys, both new tables are read-only for the app; only the Edge Functions change them.

alter table public.api_keys drop column models;

create table public.provider_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('gemini', 'openai', 'claude')),
  model text not null check (char_length(model) between 1 and 80),
  sort_order integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, provider, model)
);
create index provider_models_idx on public.provider_models (user_id, provider, sort_order);

create table public.provider_order (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('gemini', 'openai', 'claude')),
  sort_order integer not null,
  primary key (user_id, provider)
);

alter table public.provider_models enable row level security;
create policy "owner can read" on public.provider_models for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.provider_models from anon;
revoke insert, update, delete on public.provider_models from authenticated;

alter table public.provider_order enable row level security;
create policy "owner can read" on public.provider_order for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.provider_order from anon;
revoke insert, update, delete on public.provider_order from authenticated;

-- ---------------------------------------------------------------- key functions (models removed)

drop function public.app_add_api_key(uuid, text, text, text[], text);
drop function public.app_get_api_secrets(uuid, text[], uuid);

create function public.app_add_api_key(p_user uuid, p_provider text, p_label text, p_secret text)
returns uuid
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

  insert into api_keys (user_id, provider, label, sort_order, hint, vault_secret_id)
  values (p_user, p_provider, p_label, v_order, right(p_secret, 4), v_secret)
  returning id into v_id;

  return v_id;
end $$;

create function public.app_get_api_secrets(p_user uuid, p_providers text[], p_id uuid default null)
returns table (id uuid, provider text, label text, key_order integer, secret text)
language sql security definer set search_path = public, vault as $$
  select k.id, k.provider, k.label, k.sort_order, s.decrypted_secret
  from api_keys k
  join vault.decrypted_secrets s on s.id = k.vault_secret_id
  where k.user_id = p_user
    and k.provider = any (p_providers)
    and (p_id is null or k.id = p_id)
  order by k.sort_order;
$$;

-- ---------------------------------------------------------------- model and provider-order functions

create function public.app_add_model(p_user uuid, p_provider text, p_model text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if (select count(*) from provider_models where user_id = p_user and provider = p_provider) >= 20 then
    raise exception 'Too many models (limit 20 per provider).';
  end if;

  insert into provider_models (user_id, provider, model, sort_order)
  values (
    p_user, p_provider, p_model,
    (select coalesce(max(sort_order), 0) + 1 from provider_models where user_id = p_user and provider = p_provider)
  )
  returning id into v_id;
  return v_id;
end $$;

create function public.app_remove_model(p_user uuid, p_id uuid)
returns void
language sql security definer set search_path = public as $$
  delete from provider_models where id = p_id and user_id = p_user;
$$;

create function public.app_reorder_models(p_user uuid, p_provider text, p_ids uuid[])
returns void
language sql security definer set search_path = public as $$
  update provider_models m set sort_order = o.ord
  from unnest(p_ids) with ordinality as o (id, ord)
  where m.id = o.id and m.user_id = p_user and m.provider = p_provider;
$$;

create function public.app_reorder_providers(p_user uuid, p_providers text[])
returns void
language sql security definer set search_path = public as $$
  insert into provider_order (user_id, provider, sort_order)
  select p_user, o.provider, o.ord
  from unnest(p_providers) with ordinality as o (provider, ord)
  on conflict (user_id, provider) do update set sort_order = excluded.sort_order;
$$;

revoke all on function public.app_add_api_key(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.app_get_api_secrets(uuid, text[], uuid) from public, anon, authenticated;
revoke all on function public.app_add_model(uuid, text, text) from public, anon, authenticated;
revoke all on function public.app_remove_model(uuid, uuid) from public, anon, authenticated;
revoke all on function public.app_reorder_models(uuid, text, uuid[]) from public, anon, authenticated;
revoke all on function public.app_reorder_providers(uuid, text[]) from public, anon, authenticated;

grant execute on function public.app_add_api_key(uuid, text, text, text) to service_role;
grant execute on function public.app_get_api_secrets(uuid, text[], uuid) to service_role;
grant execute on function public.app_add_model(uuid, text, text) to service_role;
grant execute on function public.app_remove_model(uuid, uuid) to service_role;
grant execute on function public.app_reorder_models(uuid, text, uuid[]) to service_role;
grant execute on function public.app_reorder_providers(uuid, text[]) to service_role;
