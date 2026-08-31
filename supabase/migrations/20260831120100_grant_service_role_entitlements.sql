-- The bank-transfer confirm path (admin_confirm_bank_transfer) calls
-- grant_digital_access() internally via `perform`, which runs as the
-- function owner regardless of grants — already verified live. The
-- future payment-webhook path (src/app/api/webhooks/payments/route.ts)
-- calls it directly from the service_role client instead, which DOES
-- need its own explicit EXECUTE grant (service_role bypasses RLS, but
-- that's a separate privilege system from function EXECUTE grants).
-- Granted now so this isn't a landmine for whoever wires in the first
-- real payment provider.
grant execute on function public.grant_digital_access(uuid, uuid) to service_role;
