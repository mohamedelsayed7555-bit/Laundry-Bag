-- Self-service password recovery for customers who cannot use an e-mail link.
--
-- Support verifies the caller on WhatsApp as before, but instead of setting a password
-- and reading it out, staff issue a short-lived code and the customer sets the password
-- himself. Nothing here is ever readable by a client: the code is stored hashed and the
-- table has no policies, so only the service role (our two server routes) can touch it.

create table if not exists public.password_reset_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  -- sha256 of the code; the plaintext exists only in the reply to the issuing request.
  code_hash   text not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  -- Which staff member issued it, so every reset is attributable.
  issued_by   uuid references public.users(id) on delete set null,
  attempts    smallint not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_password_reset_codes_user
  on public.password_reset_codes (user_id, created_at desc);

create index if not exists idx_password_reset_codes_hash
  on public.password_reset_codes (code_hash)
  where used_at is null;

alter table public.password_reset_codes enable row level security;
-- Deliberately no policies: every client role is denied, service role bypasses RLS.

-- Housekeeping: a code is useless once it expires, and keeping it around only widens
-- the window for a brute-force attempt against an old hash.
create or replace function public.purge_expired_reset_codes()
returns void
language sql
security definer
set search_path to 'public'
as $$
  delete from public.password_reset_codes
  where expires_at < now() - interval '1 day';
$$;

revoke all on function public.purge_expired_reset_codes() from public, anon, authenticated;

-- Revoking every session for one account.
--
-- supabase-js only exposes admin.signOut(jwt), which needs a token we do not have when
-- the customer is resetting a password he cannot sign in with. Deleting the account's
-- sessions is the equivalent: refresh tokens cascade from auth.sessions, so whoever is
-- signed in anywhere else is signed out within one token refresh.
create or replace function public.revoke_user_sessions(p_user uuid)
returns void
language plpgsql
security definer
set search_path to 'auth', 'public'
as $$
begin
  delete from auth.refresh_tokens where user_id = p_user::text;
  delete from auth.sessions where user_id = p_user;
end;
$$;

revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;

-- RLS already denies every row (no policies), but the default grants on public tables
-- still hand anon/authenticated table-level rights. Revoke them so a future policy
-- added by mistake cannot expose code hashes.
revoke all on table public.password_reset_codes from anon, authenticated;
