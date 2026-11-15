-- 0011_watch_links.sql
-- Where the Watch button sends you: link templates the user fills in under Profile → Watch link.
alter table user_settings add column if not exists watch_links jsonb not null default '{}'::jsonb;
