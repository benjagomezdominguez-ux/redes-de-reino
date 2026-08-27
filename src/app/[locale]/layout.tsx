import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { siteUrl, site } from "@/lib/site-config";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import "../globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

const openGraphLocales: Record<Locale, string> = {
  es: "es_AR",
  en: "en_US",
  pt: "pt_BR",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  const languages = Object.fromEntries(
    routing.locales.map((l) => [l, `${siteUrl}/${l}`])
  );

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: t("title"),
      template: `%s | ${site.name}`,
    },
    description: t("description"),
    alternates: {
      canonical: `${siteUrl}/${locale}`,
      languages,
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: `${siteUrl}/${locale}`,
      siteName: site.name,
      locale: openGraphLocales[locale as Locale],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: site.name,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-text">
        <NextIntlClientProvider messages={messages}>
          {children}
          <ServiceWorkerRegistration />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
