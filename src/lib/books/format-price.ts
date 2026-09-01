// Shared by every place that renders a book/order price (admin books,
// admin orders, cart, checkout, pedidos). "es-AR" on purpose — ARS is
// this store's actual currency (not just its default label), and its
// real format (thousands separator ".", decimal separator ",") doesn't
// change with the visitor's UI language, same as any other currency's
// native formatting wouldn't.
export function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
