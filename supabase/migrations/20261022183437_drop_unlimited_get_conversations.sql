-- The capped version takes an extra argument with a default, which creates a second
-- function rather than replacing this one. Left in place, a call naming only
-- p_user_id matches both and is refused as ambiguous.
drop function if exists public.get_conversations(uuid);
