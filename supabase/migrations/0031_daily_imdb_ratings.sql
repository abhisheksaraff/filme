-- 0031_daily_imdb_ratings.sql
-- Every morning the project asks the "imdb-daily" function to fill in IMDb's newest ratings for the titles in the app.
--
-- One-time set-up, run once in the SQL editor with your own values (they are stored in Supabase's vault, never in this file):
--   select vault.create_secret('https://YOUR-PROJECT.supabase.co', 'project_url');
--   select vault.create_secret('YOUR-SERVICE-ROLE-KEY', 'service_role_key');
-- If either already exists, skip it. Then deploy the "imdb-daily" function.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'imdb-daily') then
    perform cron.unschedule('imdb-daily');
  end if;
end $$;

-- 08:17 UTC every day (about 3 in the morning in Toronto).
select cron.schedule(
  'imdb-daily',
  '17 8 * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/imdb-daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);
