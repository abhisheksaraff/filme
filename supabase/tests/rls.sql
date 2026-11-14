-- rls.sql
-- Run in the Supabase SQL editor after every migration. It raises an error if any table in
-- the public schema is missing Row Level Security or has no policy.

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

  raise notice 'RLS check passed';
end $$;
