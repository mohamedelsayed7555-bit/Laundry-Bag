-- Live updates for subscriptions (dashboard sound + list refresh). RLS still limits rows per user.
alter publication supabase_realtime add table public.subscriptions;
