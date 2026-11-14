-- 0007_step6.sql
-- Moving holidays, a public bucket for custom posters, a storage meter and new settings columns.

-- ---------------------------------------------------------------- moving holidays
-- Their dates change every year, so one validated AI lookup per year fills holiday_dates.
insert into public.holidays (slug, name, date_type, theme, keywords) values
  ('diwali', 'Diwali', 'moving', 'diwali', array['diwali']),
  ('lunar-new-year', 'Lunar New Year', 'moving', 'lunar-new-year', array['chinese new year']),
  ('eid-al-fitr', 'Eid al-Fitr', 'moving', 'eid', array['eid']),
  ('eid-al-adha', 'Eid al-Adha', 'moving', 'eid', array['eid']),
  ('hanukkah', 'Hanukkah', 'moving', 'hanukkah', array['hanukkah'])
on conflict (slug) do nothing;

-- ---------------------------------------------------------------- custom posters and covers
-- Posters and covers are not sensitive, so they live in a public bucket and can be used as plain
-- image URLs everywhere a TMDB poster would go. Ticket stubs and photos stay in the private bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "covers: own folder, insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "covers: own folder, update" on storage.objects for update to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "covers: own folder, delete" on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------- storage meter
-- Bytes the signed-in user has stored, so the app can show how much of the free 1 GB is used.
create function public.my_storage_bytes() returns bigint
language sql stable security definer set search_path = public, storage as $$
  select coalesce(sum((metadata ->> 'size')::bigint), 0)
  from storage.objects
  where bucket_id in ('media', 'covers')
    and (storage.foldername(name))[1] = (select auth.uid())::text
$$;
revoke all on function public.my_storage_bytes() from public, anon;
grant execute on function public.my_storage_bytes() to authenticated;

-- ---------------------------------------------------------------- settings
alter table public.user_settings
  add column decorations_enabled boolean not null default true,
  add column birthday text check (birthday ~ '^\d{2}-\d{2}$'),     -- MM-DD, for the birthday theme
  add column city text,
  add column region text check (region ~ '^[A-Z]{2}$'),             -- ISO country code for theatre listings
  add column last_backup_at timestamptz;
