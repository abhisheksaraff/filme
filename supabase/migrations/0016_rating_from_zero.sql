-- 0016_rating_from_zero.sql
-- Ratings may now run from 0 to 10 in half steps (they used to start at 1).
alter table public.watch_sessions drop constraint if exists watch_sessions_rating_check;
alter table public.watch_sessions add constraint watch_sessions_rating_check
  check (rating is null or (rating between 0 and 10 and (rating * 2) = round(rating * 2)));
