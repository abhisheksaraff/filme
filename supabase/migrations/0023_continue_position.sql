-- 0023_continue_position.sql
-- Continue watching follows where you are in a show, and a show can be taken off Home.

-- Aired episodes of each season (season 0 holds the specials), as [{"season": 1, "episodes": 10}, ...], so the ring can say
-- how far into a show you are. Filled the next time a show's count is refreshed; rows saved before this have none.
alter table public.show_progress add column if not exists aired_by_season jsonb;

-- The time the newest viewing of a show was added when the show was taken off Home's Continue watching. Both times come from
-- the server, so clocks cannot disagree. The show comes back as soon as a viewing is added after it.
alter table public.show_follows add column if not exists continue_removed_after timestamptz;
