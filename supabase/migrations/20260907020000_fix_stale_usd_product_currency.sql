-- Data correction, not a currency conversion: one product ("columnas",
-- digital) was created on 2026-08-31 — before
-- 20260901180000_switch_base_currency_to_ars.sql switched the store's
-- base currency to ARS — and was never updated, so it's still labeled
-- currency='USD' even though its price (750000 cents) was always meant
-- to be pesos (its own physical sibling variant, created the same week,
-- is priced at 1,500,000 cents in ARS — a sensible ~2x digital/physical
-- ratio only if both are read as the same currency). The admin product
-- form has hardcoded currency to 'ARS' for every product ever since
-- (src/lib/actions/admin-books.ts), and create_order() already reads
-- price/currency straight off the product row — so relabeling this one
-- stale row is enough to make display AND the real purchase flow
-- consistent, with no invented exchange rate and no code changes needed.
--
-- Scoped broadly (any product still marked USD) rather than by id: under
-- this single-tenant, ARS-only architecture, no product should ever be
-- priced in USD, so this also self-heals any other row in the same
-- stale state.
update public.products
set currency = 'ARS'
where currency = 'USD';
