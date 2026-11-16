-- What happened the last time each saved key was used or tested, shown as a tick or a cross on the keys page.
-- No mark (all three empty) means the key has not been used or tested yet. Only the Edge Functions write these.
alter table public.api_keys
  add column if not exists last_ok boolean,
  add column if not exists last_message text check (char_length(last_message) <= 200),
  add column if not exists last_checked_at timestamptz;

create or replace function public.app_record_key_result(p_user uuid, p_id uuid, p_ok boolean, p_message text)
returns void
language sql security definer set search_path = public as $$
  update api_keys
     set last_ok = p_ok, last_message = left(p_message, 200), last_checked_at = now()
   where id = p_id and user_id = p_user;
$$;

revoke all on function public.app_record_key_result(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.app_record_key_result(uuid, uuid, boolean, text) to service_role;
