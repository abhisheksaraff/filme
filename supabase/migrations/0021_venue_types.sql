-- Venue types for the map and the venue picker: more kinds of place, and the kind saved on each viewing, so one address
-- used for two kinds of thing (a hall for a film, then for a concert) can show two pins.
alter table public.venues drop constraint if exists venues_type_check;
alter table public.venues add constraint venues_type_check
  check (type in ('cinema', 'home', 'concert', 'theatre', 'dance', 'comedy', 'arena', 'festival', 'drivein', 'friend', 'travel', 'other', 'stadium', 'club'));

alter table public.watch_sessions
  add column if not exists venue_type text
  check (venue_type is null or venue_type in ('cinema', 'home', 'concert', 'theatre', 'dance', 'comedy', 'arena', 'festival', 'drivein', 'friend', 'travel', 'other'));

-- Anything named Home is a home.
update public.venues set type = 'home' where lower(trim(name)) = 'home' and type <> 'home';
