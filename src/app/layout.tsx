import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { siteUrl } from "@/lib/site-config";
import "./globals.css";

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

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Redes de Reino | Iglesia",
    template: "%s | Redes de Reino",
  },
  description:
    "Redes de Reino — Una comunidad de fe, crecimiento y propósito en Salta, Argentina.",
  openGraph: {
    title: "Redes de Reino | Iglesia",
    description:
      "Redes de Reino — Una comunidad de fe, crecimiento y propósito en Salta, Argentina.",
    url: siteUrl,
    siteName: "Redes de Reino",
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Redes de Reino | Iglesia",
    description:
      "Redes de Reino — Una comunidad de fe, crecimiento y propósito en Salta, Argentina.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-text">
        {children}
      </body>
    </html>
  );
}
