-- Switches the book store's base currency to ARS (Argentine peso), per
-- explicit request. Two things needed fixing, not just a default:
--
-- 1. `products.currency` / `orders.currency` defaulted to 'USD' (set in
--    20260831120000) — now default to 'ARS'.
-- 2. create_order() hardcoded the literal 'USD' directly into the order
--    and payment rows, completely ignoring products.currency — a latent
--    bug independent of this currency switch (if a product's currency
--    ever differed from that hardcoded literal, the order/payment would
--    silently charge in the wrong currency label). Fixed to read the
--    real currency off the product being purchased instead.
--
-- Existing rows are untouched on purpose (rule: never alter historical
-- orders/payments) — this only changes what NEW rows get.

alter table public.products
  alter column currency set default 'ARS';

alter table public.orders
  alter column currency set default 'ARS';

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
  v_currency text;
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
  values (p_user_id, p_email, 'pending', 'ARS', 0, 0, 0, 0, false, p_payment_method, p_billing_country)
  returning id, reference into v_order_id, v_reference;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products
    where id = (v_item->>'product_id')::uuid and status = 'active';

    if not found then
      raise exception 'Product % is not available', (v_item->>'product_id');
    end if;

    -- Every product in this single-tenant store shares one currency in
    -- practice; the order's currency is simply the currency of whatever
    -- it's actually made of, read from the real product rows, never a
    -- hardcoded guess.
    v_currency := v_product.currency;

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
  set currency = coalesce(v_currency, 'ARS'),
      subtotal_cents = v_subtotal,
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
    coalesce(v_currency, 'ARS'),
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
