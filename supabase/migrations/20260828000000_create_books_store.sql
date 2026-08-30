-- Books store schema: catalog, orders, shipping, and digital entitlements.
--
-- Design notes:
-- * Prices live only here, in cents, never trusted from the client — see
--   the create_order() function below, which is the only way to create an
--   order and always re-reads price/stock from this table.
-- * product_files.storage_path points into a PRIVATE Storage bucket
--   ("book-files", created separately — see README). It is never exposed
--   through any SELECT policy; only the signed-URL delivery route (using
--   the secret key, which bypasses RLS) may read it.
-- * digital_entitlements is the explicit "right to access" record rule 52
--   asked for — a purchase alone never grants access; an entitlement row
--   is what the download route checks.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  slug text not null unique,
  title text,
  author text,
  description text,
  cover_url text,
  category text,
  language text not null default 'es',
  product_type text not null check (product_type in ('digital', 'fisico', 'digital_fisico')),
  digital_price_cents integer check (digital_price_cents is null or digital_price_cents >= 0),
  physical_price_cents integer check (physical_price_cents is null or physical_price_cents >= 0),
  currency text not null default 'ARS',
  -- null = not stock-tracked (e.g. pure digital); a number is the real
  -- count for physical/digital_fisico products.
  stock integer check (stock is null or stock >= 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'inactive')),
  sort_order integer not null default 0
);

alter table public.products enable row level security;

create policy "Anyone can view active products"
  on public.products
  for select
  to anon, authenticated
  using (status = 'active');

create table public.product_files (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  file_type text not null default 'pdf'
);

alter table public.product_files enable row level security;
-- Intentionally no policies at all: this table is only ever read using
-- the secret key (which bypasses RLS), from the signed-URL route.

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'pending' check (status in (
    'pending', 'payment_processing', 'paid', 'processing', 'shipped',
    'delivered', 'cancelled', 'refunded', 'failed'
  )),
  currency text not null default 'ARS',
  subtotal_cents integer not null check (subtotal_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  requires_shipping boolean not null default false
);

alter table public.orders enable row level security;

create policy "Users can view their own orders"
  on public.orders
  for select
  to authenticated
  using (auth.uid() = user_id);
-- No insert/update policies for anon/authenticated: orders are only ever
-- created via create_order() (security definer) and only ever updated by
-- server-side code holding the secret key (e.g. a payment webhook).

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  modality text not null check (modality in ('digital', 'fisico', 'digital_fisico')),
  quantity integer not null default 1 check (quantity > 0),
  -- Price captured at purchase time — this is what was actually charged,
  -- independent of later price changes to the product.
  unit_price_cents integer not null check (unit_price_cents >= 0),
  title_snapshot text,
  author_snapshot text
);

alter table public.order_items enable row level security;

create policy "Users can view items of their own orders"
  on public.order_items
  for select
  to authenticated
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.user_id = auth.uid()
    )
  );

create table public.shipping_addresses (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text,
  country text not null,
  state text not null,
  city text not null,
  postal_code text not null,
  street text not null,
  number text not null,
  floor_unit text,
  notes text
);

alter table public.shipping_addresses enable row level security;

create policy "Users can view shipping addresses of their own orders"
  on public.shipping_addresses
  for select
  to authenticated
  using (
    exists (
      select 1 from public.orders
      where orders.id = shipping_addresses.order_id
        and orders.user_id = auth.uid()
    )
  );

create table public.digital_entitlements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null default 'granted' check (status in ('granted', 'revoked')),
  unique (user_id, product_id, order_id)
);

alter table public.digital_entitlements enable row level security;

create policy "Users can view their own entitlements"
  on public.digital_entitlements
  for select
  to authenticated
  using (auth.uid() = user_id);
-- No insert policy: entitlements are only ever granted by
-- grant_digital_access(), called with the secret key once a payment is
-- confirmed (see rule 8 — the payment's real, server-confirmed status is
-- the only source of truth for unlocking a digital file).

-- Creates a pending order for the authenticated caller, re-validating
-- product/price/stock from this table (never from client input) and
-- atomically decrementing stock for physical items. SECURITY DEFINER so
-- it can safely lock and update products.stock without granting broad
-- UPDATE rights to authenticated users.
create or replace function public.create_order(
  p_user_id uuid,
  p_email text,
  p_items jsonb, -- [{ "product_id": uuid, "modality": text, "quantity": int }]
  p_shipping jsonb default null -- { first_name, last_name, phone, country, state, city, postal_code, street, number, floor_unit, notes }
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_product record;
  v_unit_price integer;
  v_subtotal integer := 0;
  v_requires_shipping boolean := false;
  v_order_id uuid;
begin
  if auth.uid() is null or auth.uid() != p_user_id then
    raise exception 'Not authorized';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'No items';
  end if;

  -- Lock every referenced product row up front (stable order avoids
  -- deadlocks between concurrent checkouts touching overlapping items).
  perform 1 from public.products
  where id in (select (i->>'product_id')::uuid from jsonb_array_elements(p_items) i)
  order by id
  for update;

  insert into public.orders (user_id, email, status, currency, subtotal_cents, shipping_cents, total_cents, requires_shipping)
  values (p_user_id, p_email, 'pending', 'ARS', 0, 0, 0, false)
  returning id into v_order_id;

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

  update public.orders
  set subtotal_cents = v_subtotal,
      -- Real shipping cost calculation is pending business configuration
      -- (see rule 29) — charging 0 rather than inventing a number.
      shipping_cents = 0,
      total_cents = v_subtotal,
      requires_shipping = v_requires_shipping
  where id = v_order_id;

  return v_order_id;
end;
$$;

revoke all on function public.create_order(uuid, text, jsonb, jsonb) from public;
grant execute on function public.create_order(uuid, text, jsonb, jsonb) to authenticated;

-- Grants digital access for every digital/digital_fisico item on an order.
-- Callable only with the secret key (no grant to anon/authenticated) —
-- this is what a real payment webhook would call once it confirms
-- payment; there is no code path that grants access without it.
create or replace function public.grant_digital_access(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.digital_entitlements (user_id, product_id, order_id, status)
  select o.user_id, oi.product_id, o.id, 'granted'
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  where o.id = p_order_id
    and oi.modality in ('digital', 'digital_fisico')
  on conflict (user_id, product_id, order_id) do nothing;
end;
$$;

revoke all on function public.grant_digital_access(uuid) from public, anon, authenticated;
