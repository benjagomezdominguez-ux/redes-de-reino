import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { navLinks, site } from "@/lib/site-config";

export async function Footer() {
  const t = await getTranslations("nav");
  const tCommon = await getTranslations("common");
  const tFooter = await getTranslations("footer");

  return (
    <footer className="border-t border-border bg-primary-950 py-12 text-white/80">
      <Container className="flex flex-col gap-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt={tCommon("logoAlt", { name: site.name })}
              width={36}
              height={36}
              className="h-9 w-9 rounded-full"
            />
            <span className="font-display text-lg font-medium text-white">
              {site.name}
            </span>
          </div>

          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="hover:text-white">
                  {t(link.key)}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 pt-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.name}. {tFooter("rights")}
          </p>
          <p className="text-white/60">{site.location}</p>
        </div>
      </Container>
    </footer>
  );
}
