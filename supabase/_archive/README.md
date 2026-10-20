# Archived SQL — do not apply

Files here are kept for reference only. They are **not** migrations and must never
be run against the database. The `.superseded` suffix keeps them out of any tooling
that globs `migrations/*.sql`.

## 20260910_enable_rls.sql.superseded

An early RLS setup written 2026-09-10, before the business took its first order
(2026-09-25). It was never applied — verified against `pg_policies`: none of the
policies it defines exist in the database. It was moved out of `supabase/migrations/`
on 2026-10-20 because sitting there implied it was live, and that was actively
misleading: a security audit read it as the running configuration and reported three
critical vulnerabilities that do not exist.

It is retained rather than deleted only as a record of the original intent. Applying
it would *create* real holes, because it is strictly weaker than what runs today:

- `users_read_basic_info ON users FOR SELECT USING (true)` — no `TO` clause, so it
  covers `anon`. The public key shipped in both mobile apps would then dump every
  user row: names, phones, emails, FCM tokens. No trigger guards reads, so there
  would be no second line of defence.
  Live equivalents are scoped: `users_own` (yourself), `users_order_participants`
  (only the driver on your order), `users_admin` (staff).
- `customers_update_own_orders` / `drivers_update_assigned_orders` — `FOR UPDATE`
  with no `WITH CHECK` and no column restriction, so any column of your own order
  is writable. The money columns happen to be covered by a guard trigger today, but
  the policy itself grants far more than intended.
- `users_update_own_subscriptions` — same shape, would allow a customer to set their
  own subscription `status`, `total_paid` and `end_date`.

The authoritative RLS configuration is whatever is live in the database, plus the
tracked migrations in `supabase/migrations/`.
