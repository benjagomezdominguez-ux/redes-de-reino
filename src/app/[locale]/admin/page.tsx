import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDashboardCounts } from "@/lib/admin/queries";
import { getTiendanubeConnectionStatus } from "@/lib/admin/tiendanube-queries";

const BANNER_KEYS = ["connected", "invalid_state", "error", "save_failed"] as const;
type BannerKey = (typeof BANNER_KEYS)[number];

export default async function AdminDashboardPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  const { tiendanube } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("admin.dashboard");

  const counts = await getDashboardCounts();
  const tiendanubeStatus = await getTiendanubeConnectionStatus();

  const cards: Array<{ label: string; value: number }> = [
    { label: t("registeredUsers"), value: counts.registeredUsers },
    { label: t("purchases"), value: counts.purchases },
    { label: t("pendingOrders"), value: counts.pendingOrders },
    { label: t("booksSold"), value: counts.booksSold },
  ];

  const banner = BANNER_KEYS.includes(tiendanube as BannerKey) ? (tiendanube as BannerKey) : null;

  return (
    <div className="flex flex-col gap-6">
      {banner ? (
        <p
          role="status"
          className={`rounded-2xl p-4 text-sm font-medium ${
            banner === "connected" ? "bg-success/10 text-success" : "bg-error/10 text-error"
          }`}
        >
          {t(`tiendanube.banners.${banner}`)}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-6 shadow-soft"
          >
            <span className="text-sm font-semibold uppercase tracking-wide text-secondary-600">
              {card.label}
            </span>
            <span className="font-display text-4xl font-medium text-primary-900">
              {card.value}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-medium text-primary-900">{t("tiendanube.title")}</h2>
          <p className="text-sm text-muted">
            {tiendanubeStatus.connected
              ? t("tiendanube.connected", { storeId: tiendanubeStatus.storeId ?? "" })
              : t("tiendanube.notConnected")}
          </p>
        </div>
        {!tiendanubeStatus.connected ? (
          // Plain <a>, not next-intl's <Link>: this isn't a page, it's an
          // API route that immediately redirects to Tiendanube — it needs
          // a real full-page navigation, not client-side route handling.
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a
            href="/api/tiendanube/oauth/start"
            className="inline-flex items-center justify-center rounded-full bg-primary-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
          >
            {t("tiendanube.connect")}
          </a>
        ) : null}
      </div>
    </div>
  );
}
