import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDashboardCounts } from "@/lib/admin/queries";

export default async function AdminDashboardPage({
  params,
}: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.dashboard");

  const counts = await getDashboardCounts();

  const cards: Array<{ label: string; value: number }> = [
    { label: t("registeredUsers"), value: counts.registeredUsers },
    { label: t("purchases"), value: counts.purchases },
    { label: t("pendingOrders"), value: counts.pendingOrders },
    { label: t("booksSold"), value: counts.booksSold },
  ];

  return (
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
  );
}
