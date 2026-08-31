-- Real payment system: a single orders/payments pipeline shared by both
-- "pay online" (architecture-only until a real provider is configured —
-- see README) and "bank transfer" (fully functional today, no external
-- API needed — an admin verifies it by hand, which is the only honest
-- way to confirm a transfer without a banking integration).
--
-- Design notes:
-- * A book is NEVER unlocked by anything the client claims. The only
--   thing that ever calls grant_digital_access() is
--   admin_confirm_bank_transfer() (a real admin, server-side, after
--   reviewing evidence) or — once configured — a verified payment
--   webhook. Nothing else.
-- * payments is a separate table from orders on purpose: an order can
--   have exactly one real payment method, but keeping it separate keeps
--   the amount-confirmed-by-whom-and-when audit trail explicit and gives
--   webhooks (payment_events) something concrete to reference.
-- * tax_rules starts empty — see rule 11 in the prompt this implements:
--   no invented tax rates. An empty table means 0% everywhere until a
--   real rate is added, which is honest, not a bug.

alter table public.products
  alter column currency set default 'USD';

alter table public.orders
  add column payment_method text not null default 'bank_transfer' check (payment_method in ('online', 'bank_transfer')),
  add column tax_cents integer not null default 0 check (tax_cents >= 0),
  add column billing_country text,
  add column reference text unique;

alter table public.orders alter column currency set default 'USD';

create sequence public.order_reference_seq;

create or replace function public.set_order_reference()
returns trigger
language plpgsql
as $$
begin
  if new.reference is null then
    new.reference := 'RR-' || extract(year from now())::text || '-' ||
      lpad(nextval('public.order_reference_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger set_order_reference_trigger
  before insert on public.orders
  for each row execute function public.set_order_reference();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  order_id uuid not null references public.orders(id) on delete cascade,
  method text not null check (method in ('online', 'bank_transfer')),
  -- 'manual' for bank transfers reviewed by a human; the real gateway
  -- name (e.g. 'mercadopago') once one is configured for 'online'.
  provider text,
  -- The gateway's own transaction/payment id — never set for transfers.
  provider_reference text,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected', 'refunded')),
  -- The order reference the buyer is told to cite (rule 20) — duplicated
  -- here (also on orders.reference) so a payment row is self-describing.
  bank_reference text,
  proof_storage_path text,
  declared_operation_number text,
  declared_amount_cents integer,
  declared_at date,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_notes text
);

alter table public.payments enable row level security;

create policy "Users can view payments on their own orders"
  on public.payments
  for select
  to authenticated
  using (
    exists (
      select 1 from public.orders
      where orders.id = payments.order_id and orders.user_id = auth.uid()
    )
  );

create policy "Admins can view all payments"
  on public.payments
  for select
  to authenticated
  using (public.is_admin(auth.uid()));
-- No insert/update policy for the client: rows are only ever created by
-- create_order() and mutated by submit_transfer_proof() /
-- admin_confirm_bank_transfer() / admin_reject_bank_transfer(), all
-- SECURITY DEFINER below.

-- Webhook idempotency (rule 17): a (provider, event_id) pair can only be
-- recorded once. Only ever written by the future webhook route handler
-- using the admin/service-role client — no client policies at all.
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  order_id uuid references public.orders(id),
  payload jsonb,
  unique (provider, event_id)
);

alter table public.payment_events enable row level security;

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references auth.users(id),
  action text not null,
  resource_type text not null,
  resource_id text,
  -- Never put secrets/tokens/full card data here — only ids and amounts.
  metadata jsonb
);

alter table public.audit_log enable row level security;

create policy "Admins can view the audit log"
  on public.audit_log
  for select
  to authenticated
  using (public.is_admin(auth.uid()));
-- No client insert policy — every write goes through a SECURITY DEFINER
-- function below, which is the only thing that can populate this table
-- with a trustworthy actor_id.

-- country_code/region_code/product_type = null means "applies broadly at
-- that level" — kept for future refinement, not used by the simple
-- country-only lookup in create_order() below until real rules exist.
create table public.tax_rules (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  country_code text not null,
  region_code text,
  product_type text,
  rate_bps integer not null check (rate_bps >= 0),
  active boolean not null default true,
  unique (country_code, region_code, product_type)
);

alter table public.tax_rules enable row level security;

create policy "Admins can view tax rules"
  on public.tax_rules
  for select
  to authenticated
  using (public.is_admin(auth.uid()));
-- No broader read policy: create_order() is SECURITY DEFINER and reads
-- this table with the function owner's privileges regardless of RLS, so
-- tax calculation works without exposing the rules table to anon/authenticated.

alter table public.digital_entitlements
  add column payment_id uuid references public.payments(id);

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('book-covers', 'book-covers', true)
on conflict (id) do nothing;

-- Covers are meant to be publicly visible (they're catalog images), but
-- only admins upload/replace them — and that's enforced in the app layer
-- (requireAdmin() + the admin/service-role client in the Server Action),
-- not via a storage RLS policy, matching how every other admin write in
-- this project already works. Only a public SELECT policy is needed here.
create policy "Anyone can view book covers"
  on storage.objects
  for select
  to public
  using (bucket_id = 'book-covers');
-- book-files and payment-proofs intentionally have zero storage.objects
-- policies: nothing is ever servable by a plain URL. Reads/writes only
-- ever happen through the admin/service-role client from
-- requireAdmin()-gated Server Actions or resolveDigitalAccessUrl().

drop function if exists public.grant_digital_access(uuid);

create or replace function public.grant_digital_access(p_order_id uuid, p_payment_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.digital_entitlements (user_id, product_id, order_id, payment_id, status)
  select o.user_id, oi.product_id, o.id, p_payment_id, 'granted'
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  where o.id = p_order_id
    and oi.modality in ('digital', 'digital_fisico')
  on conflict (user_id, product_id, order_id) do nothing;
end;
$$;

revoke all on function public.grant_digital_access(uuid, uuid) from public, anon, authenticated;

drop function if exists public.create_order(uuid, text, jsonb, jsonb);

-- Creates a pending order AND its pending payment row in one transaction.
-- Re-validates product/price/stock from the products table (never from
-- client input, rule 10), computes tax server-side from tax_rules (rule
-- 11/45), and generates the order's human-readable reference via the
-- trigger above. Returns enough for the checkout UI to show transfer
-- instructions immediately without a second round trip.
create or replace function public.create_order(
  p_user_id uuid,
  p_email text,
  p_items jsonb, -- [{ "product_id": uuid, "modality": text, "quantity": int }]
  p_shipping jsonb default null,
  p_payment_method text default 'bank_transfer',
  p_billing_country text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_product record;
  v_unit_price integer;
  v_subtotal integer := 0;
  v_tax integer := 0;
  v_tax_rate_bps integer;
  v_requires_shipping boolean := false;
  v_order_id uuid;
  v_reference text;
  v_total integer;
begin
  if auth.uid() is null or auth.uid() != p_user_id then
    raise exception 'Not authorized';
  end if;

  if p_payment_method not in ('online', 'bank_transfer') then
    raise exception 'Invalid payment method';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'No items';
  end if;

  perform 1 from public.products
  where id in (select (i->>'product_id')::uuid from jsonb_array_elements(p_items) i)
  order by id
  for update;

  insert into public.orders (
    user_id, email, status, currency, subtotal_cents, tax_cents, shipping_cents,
    total_cents, requires_shipping, payment_method, billing_country
  )
  values (p_user_id, p_email, 'pending', 'USD', 0, 0, 0, 0, false, p_payment_method, p_billing_country)
  returning id, reference into v_order_id, v_reference;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products
    where id = (v_item->>'product_id')::uuid and status = 'active';

    if not found then
      raise exception 'Product % is not available', (v_item->>'product_id');
    end if;

    if v_item->>'modality' = 'digital' then
      v_unit_price := v_product.digital_price_cents;
    elsif v_item->>'modality' in ('fisico', 'digital_fisico') then
      v_unit_price := v_product.physical_price_cents;
      v_requires_shipping := true;

      if v_product.stock is not null then
        if v_product.stock < (v_item->>'quantity')::integer then
          raise exception 'Product % is out of stock', v_product.slug;
        end if;
        update public.products
        set stock = stock - (v_item->>'quantity')::integer
        where id = v_product.id;
      end if;
    else
      raise exception 'Invalid modality';
    end if;

    if v_unit_price is null then
      raise exception 'Product % has no price for that modality', v_product.slug;
    end if;

    insert into public.order_items (order_id, product_id, modality, quantity, unit_price_cents, title_snapshot, author_snapshot)
    values (
      v_order_id, v_product.id, v_item->>'modality', (v_item->>'quantity')::integer,
      v_unit_price, v_product.title, v_product.author
    );

    v_subtotal := v_subtotal + v_unit_price * (v_item->>'quantity')::integer;
  end loop;

  if v_requires_shipping then
    if p_shipping is null then
      raise exception 'Shipping address required';
    end if;
    insert into public.shipping_addresses (
      order_id, first_name, last_name, phone, country, state, city,
      postal_code, street, number, floor_unit, notes
    )
    values (
      v_order_id,
      p_shipping->>'first_name', p_shipping->>'last_name', p_shipping->>'phone',
      p_shipping->>'country', p_shipping->>'state', p_shipping->>'city',
      p_shipping->>'postal_code', p_shipping->>'street', p_shipping->>'number',
      p_shipping->>'floor_unit', p_shipping->>'notes'
    );
  end if;

  -- Simple country-only lookup for now (region_code/product_type stay
  -- available on the table for later refinement — see the comment on
  -- tax_rules above). No matching row = 0% tax, never an invented rate.
  select rate_bps into v_tax_rate_bps
  from public.tax_rules
  where active
    and country_code = coalesce(p_billing_country, '')
    and region_code is null
    and product_type is null
  limit 1;

  v_tax := case when v_tax_rate_bps is null then 0 else (v_subtotal * v_tax_rate_bps) / 10000 end;
  -- Real shipping cost calculation is still pending business
  -- configuration (unchanged from the original books-store migration) —
  -- charging 0 rather than inventing a number.
  v_total := v_subtotal + v_tax;

  update public.orders
  set subtotal_cents = v_subtotal,
      tax_cents = v_tax,
      shipping_cents = 0,
      total_cents = v_total,
      requires_shipping = v_requires_shipping
  where id = v_order_id;

  insert into public.payments (order_id, method, provider, amount_cents, currency, status, bank_reference)
  values (
    v_order_id,
    p_payment_method,
    case when p_payment_method = 'bank_transfer' then 'manual' else null end,
    v_total,
    'USD',
    'pending',
    v_reference
  );

  insert into public.audit_log (actor_id, action, resource_type, resource_id, metadata)
  values (
    p_user_id, 'order_created', 'order', v_order_id::text,
    jsonb_build_object('total_cents', v_total, 'payment_method', p_payment_method, 'reference', v_reference)
  );

  return jsonb_build_object(
    'order_id', v_order_id,
    'reference', v_reference,
    'total_cents', v_total,
    'payment_method', p_payment_method
  );
end;
$$;

revoke all on function public.create_order(uuid, text, jsonb, jsonb, text, text) from public;
grant execute on function public.create_order(uuid, text, jsonb, jsonb, text, text) to authenticated;

-- Lets the buyer attach evidence to their own still-pending transfer —
-- never marks anything paid by itself (rule 21: a proof is not a
-- confirmed payment). Ownership is checked here, not via an RLS policy,
-- since Postgres RLS can't cleanly express "only these specific columns
-- are updatable."
create or replace function public.submit_transfer_proof(
  p_payment_id uuid,
  p_operation_number text default null,
  p_declared_amount_cents integer default null,
  p_declared_at date default null,
  p_proof_storage_path text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select o.user_id into v_owner
  from public.payments p
  join public.orders o on o.id = p.order_id
  where p.id = p_payment_id and p.method = 'bank_transfer' and p.status = 'pending';

  if v_owner is null or v_owner != auth.uid() then
    raise exception 'Not authorized';
  end if;

  update public.payments
  set declared_operation_number = coalesce(p_operation_number, declared_operation_number),
      declared_amount_cents = coalesce(p_declared_amount_cents, declared_amount_cents),
      declared_at = coalesce(p_declared_at, declared_at),
      proof_storage_path = coalesce(p_proof_storage_path, proof_storage_path)
  where id = p_payment_id;

  insert into public.audit_log (actor_id, action, resource_type, resource_id, metadata)
  values (auth.uid(), 'transfer_proof_submitted', 'payment', p_payment_id::text, '{}'::jsonb);
end;
$$;

revoke all on function public.submit_transfer_proof(uuid, text, integer, date, text) from public;
grant execute on function public.submit_transfer_proof(uuid, text, integer, date, text) to authenticated;

-- The ONLY way a bank transfer ever unlocks a book (rule 22/27): a real
-- admin, authenticated, explicitly confirming — never automatic, never
-- because the buyer said so. Rule 23: if the buyer's own declared amount
-- is short, refuse to confirm even if an admin tries — protects against
-- an admin fat-fingering the wrong payment id while working through a
-- queue of transfers.
create or replace function public.admin_confirm_bank_transfer(
  p_payment_id uuid,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment record;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found';
  end if;
  if v_payment.method != 'bank_transfer' then
    raise exception 'Not a bank transfer payment';
  end if;
  if v_payment.status != 'pending' then
    raise exception 'Payment already reviewed';
  end if;
  if v_payment.declared_amount_cents is not null and v_payment.declared_amount_cents < v_payment.amount_cents then
    raise exception 'Declared amount is less than the amount due — cannot confirm';
  end if;

  update public.payments
  set status = 'confirmed', reviewed_by = auth.uid(), reviewed_at = now(), review_notes = p_notes
  where id = p_payment_id;

  update public.orders set status = 'paid' where id = v_payment.order_id;

  perform public.grant_digital_access(v_payment.order_id, p_payment_id);

  insert into public.audit_log (actor_id, action, resource_type, resource_id, metadata)
  values (
    auth.uid(), 'payment_confirmed', 'payment', p_payment_id::text,
    jsonb_build_object('order_id', v_payment.order_id, 'amount_cents', v_payment.amount_cents)
  );
end;
$$;

revoke all on function public.admin_confirm_bank_transfer(uuid, text) from public;
grant execute on function public.admin_confirm_bank_transfer(uuid, text) to authenticated;

create or replace function public.admin_reject_bank_transfer(
  p_payment_id uuid,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment record;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found';
  end if;
  if v_payment.status != 'pending' then
    raise exception 'Payment already reviewed';
  end if;

  update public.payments
  set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_notes = p_notes
  where id = p_payment_id;

  update public.orders set status = 'failed' where id = v_payment.order_id;

  insert into public.audit_log (actor_id, action, resource_type, resource_id, metadata)
  values (
    auth.uid(), 'payment_rejected', 'payment', p_payment_id::text,
    jsonb_build_object('order_id', v_payment.order_id, 'notes', p_notes)
  );
end;
$$;

revoke all on function public.admin_reject_bank_transfer(uuid, text) from public;
grant execute on function public.admin_reject_bank_transfer(uuid, text) to authenticated;
