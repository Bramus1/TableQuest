-- Supabase grants EXECUTE directly to authenticated in its default privileges.
-- This trigger must only run as an auth.users trigger, never through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
