-- 0009_image_stores.sql
-- Each image remembers which file store holds it, so images can move to another store a few at a
-- time without breaking anything halfway. Existing images start in Supabase Storage.
-- Safe to run more than once.
alter table public.images
  add column if not exists store text not null default 'supabase' check (store in ('supabase', 'files'));
