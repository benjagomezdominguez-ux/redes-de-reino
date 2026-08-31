import { getTranslations, setRequestLocale } from "next-intl/server";
import { NavbarWithAuth } from "@/components/sections/NavbarWithAuth";
import { Footer } from "@/components/sections/Footer";
import { Container } from "@/components/ui/Container";
import { Link } from "@/i18n/navigation";
import { getAuthProfile } from "@/lib/supabase/get-profile";
import { signOut } from "@/lib/actions/auth";

export default async function AccountPage({
  params,
}: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("account");
  const tAuth = await getTranslations("auth");

  // The (protected) layout already guarantees a session — non-null here.
  const profile = (await getAuthProfile())!;

  const fields: Array<{ label: string; value: string }> = [
    { label: t("firstName"), value: profile.firstName ?? t("notSet") },
    { label: t("lastName"), value: profile.lastName ?? t("notSet") },
    { label: t("email"), value: profile.email ?? t("notSet") },
  ];

  return (
    <>
      <NavbarWithAuth />
      <main className="flex-1 py-20 sm:py-28">
        <Container className="mx-auto max-w-2xl">
          <h1 className="mb-10 font-display text-3xl font-medium text-primary-900">
            {t("title")}
          </h1>

          <dl className="mb-8 grid grid-cols-1 gap-6 rounded-2xl border border-border bg-surface p-8 shadow-soft sm:grid-cols-3">
            {fields.map((field) => (
              <div key={field.label} className="flex flex-col gap-1">
                <dt className="text-sm font-semibold uppercase tracking-wide text-secondary-600">
                  {field.label}
                </dt>
                <dd className="text-base text-text">{field.value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/pedidos"
              className="flex-1 rounded-2xl border border-border bg-surface p-6 text-center shadow-soft transition-transform hover:-translate-y-0.5 hover:shadow-lifted"
            >
              <span className="font-display text-lg font-medium text-primary-900">
                {t("ordersLink")}
              </span>
            </Link>
            <Link
              href="/biblioteca"
              className="flex-1 rounded-2xl border border-border bg-surface p-6 text-center shadow-soft transition-transform hover:-translate-y-0.5 hover:shadow-lifted"
            >
              <span className="font-display text-lg font-medium text-primary-900">
                {t("libraryLink")}
              </span>
            </Link>
          </div>

          <form action={signOut} className="mt-8">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full border border-primary-900/20 px-6 py-3 text-sm font-semibold text-primary-900 transition-colors hover:bg-primary-900/5"
            >
              {tAuth("logout")}
            </button>
          </form>
        </Container>
      </main>
      <Footer />
    </>
  );
}
