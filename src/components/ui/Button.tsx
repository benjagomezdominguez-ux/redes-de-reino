import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline-light";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary-900 text-white hover:bg-primary-800 focus-visible:outline-secondary-500",
  secondary:
    "bg-secondary-500 text-primary-950 hover:bg-secondary-400 focus-visible:outline-primary-900",
  ghost:
    "bg-transparent text-primary-900 border border-primary-900/20 hover:border-primary-900/40 hover:bg-primary-900/5",
  "outline-light":
    "bg-transparent text-white border border-white/30 hover:border-white/60 hover:bg-white/10",
};

export function Button({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  className?: string;
}) {
  const isExternal = href.startsWith("http");

  return (
    <Link
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors duration-200 ${variantClasses[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
