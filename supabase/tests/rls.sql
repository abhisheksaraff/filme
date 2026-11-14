-- rls.sql
-- Run in the Supabase SQL editor after every migration. It raises an error if any table in
-- the public schema is missing Row Level Security or a policy, if key tables allow writes
-- from the app, or if a server-only function can be called by the app.

do $$
declare
  bad text;
begin
  select string_agg(c.relname, ', ') into bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if bad is not null then
    raise exception 'RLS is off for: %', bad;
  end if;

  select string_agg(c.relname, ', ') into bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname);
  if bad is not null then
    raise exception 'No policy on: %', bad;
  end if;

  -- Keys and usage counters are written only by the Edge Functions, never by the app.
  select string_agg(p.tablename || ' (' || p.cmd || ')', ', ') into bad
  from pg_policies p
  where p.schemaname = 'public' and p.tablename in ('api_keys', 'usage_counters') and p.cmd <> 'SELECT';
  if bad is not null then
    raise exception 'App can write to: %', bad;
  end if;

  -- Functions named app_* are for the Edge Functions' service role only.
  select string_agg(p.proname, ', ') into bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'app\_%'
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
  if bad is not null then
    raise exception 'Server-only functions callable by the app: %', bad;
  end if;

  raise notice 'RLS check passed';
end $$;
