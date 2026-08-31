import { getTranslations, setRequestLocale } from "next-intl/server";
import { NavbarWithAuth } from "@/components/sections/NavbarWithAuth";
import { Footer } from "@/components/sections/Footer";
import { Container } from "@/components/ui/Container";
import { Link } from "@/i18n/navigation";
import { ResetPasswordForm } from "@/components/ui/ResetPasswordForm";
import { getAuthProfile } from "@/lib/supabase/get-profile";

export default async function ResetPasswordPage({
  params,
}: PageProps<"/[locale]/reset-password">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  // Only reachable with a real password-reset outcome: either the
  // recovery session /auth/callback just established from the emailed
  // link's code, or none at all if the link was already used/expired.
  const profile = await getAuthProfile();

  return (
    <>
      <NavbarWithAuth />
      <main className="flex-1 py-20 sm:py-28">
        <Container className="mx-auto max-w-md">
          <div className="rounded-2xl border border-border bg-surface p-8 shadow-soft">
            <h1 className="mb-6 text-center font-display text-2xl font-medium text-primary-900">
              {t("resetPasswordTitle")}
            </h1>
            {profile ? (
              <ResetPasswordForm />
            ) : (
              <div className="flex flex-col items-center gap-4 text-center">
                <p className="text-sm text-text">{t("resetPasswordExpired")}</p>
                <Link href="/forgot-password" className="font-medium text-primary-900 underline">
                  {t("forgotPasswordTitle")}
                </Link>
              </div>
            )}
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
