import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { NavbarWithAuth } from "@/components/sections/NavbarWithAuth";
import { Footer } from "@/components/sections/Footer";
import { Container } from "@/components/ui/Container";
import { DevotionalContent } from "@/components/ui/DevotionalContent";
import { RecordDevotionalView } from "@/components/ui/RecordDevotionalView";
import { Link } from "@/i18n/navigation";
import { getPublishedDevotionalById } from "@/lib/devotionals/queries";
import { getAuthProfile } from "@/lib/supabase/get-profile";

export default async function DevotionalReadPage({
  params,
}: PageProps<"/[locale]/devocionales/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("devotionals");

  const devotional = await getPublishedDevotionalById(id);
  if (!devotional) notFound();

  // Devotionals are public — this page never gates on auth (see
  // getPublishedDevotionalById's own RLS-backed policy). Anonymous
  // visitors read exactly as before; RecordDevotionalView only mounts
  // for a real signed-in profile, and never blocks anything either way —
  // see that component's own comment.
  const profile = await getAuthProfile();

  return (
    <>
      <NavbarWithAuth />
      <main className="flex-1 py-16 sm:py-24">
        <Container className="mx-auto max-w-2xl">
          <Link href="/devocionales" className="text-sm font-medium text-primary-900/80 underline">
            {t("backToLibrary")}
          </Link>

          <article className="mt-8 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-secondary-600">
                {new Date(devotional.published_at ?? devotional.created_at).toLocaleDateString(locale, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              <h1 className="font-display text-3xl font-medium text-balance text-primary-900 sm:text-4xl">
                {devotional.title}
              </h1>
            </div>

            <div className="text-base leading-relaxed text-text sm:text-lg">
              <DevotionalContent content={devotional.content} />
            </div>
          </article>
        </Container>
      </main>
      {profile ? <RecordDevotionalView devotionalId={devotional.id} /> : null}
      <Footer />
    </>
  );
}
