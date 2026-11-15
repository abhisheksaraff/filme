-- 0018_animations_setting.sql
-- Moving theme backgrounds and still decorations (lights, garlands, accents) can now be switched separately.
alter table public.user_settings
  add column if not exists animations_enabled boolean not null default true;
