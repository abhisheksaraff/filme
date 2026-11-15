-- 0010_hidden_credits.sql
-- People the user removed from a title's cast or crew, so a later refresh from TMDB does not add them back.
-- Each entry is "<tmdb person id>:<role>", for example "287:actor".
alter table media_items add column if not exists hidden_credits jsonb not null default '[]'::jsonb;
