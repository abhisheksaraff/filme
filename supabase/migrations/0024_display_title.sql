-- The title as typed for one viewing ("Fight Club 4K"), kept beside the TMDB title the film itself is filed under.
-- Null when the viewing simply uses the film's own title.
alter table public.watch_sessions add column if not exists display_title text;
