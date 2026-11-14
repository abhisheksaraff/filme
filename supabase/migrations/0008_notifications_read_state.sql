-- 0008_notifications_read_state.sql
-- Run once in the Supabase SQL editor.
-- Notifications can be read without being dismissed, so unread ones can be put first on Home.
alter table public.notifications add column if not exists read_at timestamptz;
