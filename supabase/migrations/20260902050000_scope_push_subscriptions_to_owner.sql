-- Found during audit: the SELECT policy on push_subscriptions granted
-- read access to EVERY row once `is_chat_admin(auth.uid())` was true —
-- i.e. Ariel could read every subscription in the table, not just his
-- own. All current reads/writes go through the service-role client in
-- Server Actions (which bypasses RLS entirely), so nothing in the app
-- was actually exposed by this — but it's still the wrong policy on a
-- table that will hold other users' subscriptions once push is opened up
-- beyond Ariel, and directly matters for "ningún usuario debe poder leer
-- suscripciones ajenas" holding at the database level, not just in
-- application code.
drop policy "Only Ariel can see push subscriptions" on public.push_subscriptions;

create policy "Users see only their own push subscriptions"
  on public.push_subscriptions
  for select
  to authenticated
  using (user_id = auth.uid());
