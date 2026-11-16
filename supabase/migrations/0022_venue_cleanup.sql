-- 0022_venue_cleanup.sql
-- Keeps venues (and so addresses, map pins and suggestions) only while a viewing still uses them.
-- Run once in the Supabase SQL editor. Safe to run again.

-- 1. Removes the signed-in user's venues that no viewing refers to any more. A viewing sitting in "Recently deleted" still
--    refers to its venue, so restoring it brings the venue back intact. Runs as the caller, so row level security keeps it to their own rows.
create or replace function public.app_cleanup_venues() returns integer
language plpgsql security invoker set search_path = public as $$
declare removed integer;
begin
  delete from venues v where not exists (select 1 from watch_sessions s where s.venue_id = v.id);
  get diagnostics removed = row_count;
  return removed;
end $$;

revoke all on function public.app_cleanup_venues() from public, anon;
grant execute on function public.app_cleanup_venues() to authenticated;

-- 2. The weekly job also sweeps up venues for everyone (and still purges long forgotten deleted viewings as a backstop;
--    the app itself removes them after 24 hours, together with their stored files).
create or replace function public.weekly_cleanup() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from watch_sessions where deleted_at < now() - interval '30 days';

  delete from venues v where not exists (select 1 from watch_sessions s where s.venue_id = v.id);

  delete from media_items m
  where not exists (select 1 from watch_sessions s where s.media_id = m.id)
    and not exists (select 1 from want_to_watch w where w.media_id = m.id)
    and not exists (select 1 from collection_items c where c.media_id = m.id)
    and not exists (select 1 from recommendations r where r.media_id = m.id);

  delete from people p
  where not exists (select 1 from media_people mp where mp.person_id = p.id)
    and not exists (select 1 from images i where i.person_id = p.id);

  delete from genres g where not exists (select 1 from media_genres x where x.genre_id = g.id);
  delete from keywords k where not exists (select 1 from media_keywords x where x.keyword_id = k.id);
  delete from companies c where not exists (select 1 from media_companies x where x.company_id = c.id);

  delete from recommendations where generated_at < now() - interval '14 days';
end $$;

revoke all on function public.weekly_cleanup() from public, anon, authenticated;

-- 3. One-time repair: a home whose name is only the start of its own address (an address suggestion once replaced "Home") becomes "Home" again.
update venues
set name = 'Home'
where type = 'home'
  and address is not null
  and name <> 'Home'
  and lower(left(address, length(name))) = lower(name);

-- 4. Clear out venues that are already unused.
delete from venues v where not exists (select 1 from watch_sessions s where s.venue_id = v.id);
