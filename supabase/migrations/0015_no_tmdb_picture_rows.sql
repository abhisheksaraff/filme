-- 0015_no_tmdb_picture_rows.sql
-- Choosing a TMDB poster or cover now just points the title at it, so the rows older picks left behind are removed.
delete from public.images where source = 'tmdb' and kind in ('poster', 'backdrop');
