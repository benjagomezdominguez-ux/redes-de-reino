import { getTranslations, setRequestLocale } from "next-intl/server";
import { NavbarWithAuth } from "@/components/sections/NavbarWithAuth";
import { Footer } from "@/components/sections/Footer";
import { Container } from "@/components/ui/Container";
import { AuthForm } from "@/components/ui/AuthForm";

export default async function SignupPage({ params }: PageProps<"/[locale]/signup">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <>
      <NavbarWithAuth />
      <main className="flex-1 py-20 sm:py-28">
        <Container className="mx-auto max-w-md">
          <div className="rounded-2xl border border-border bg-surface p-8 shadow-soft">
            <h1 className="mb-6 text-center font-display text-2xl font-medium text-primary-900">
              {t("signupTitle")}
            </h1>
            <AuthForm mode="signup" />
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
