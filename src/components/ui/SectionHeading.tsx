type Tone = "light" | "dark";

const toneClasses: Record<Tone, { eyebrow: string; title: string; description: string }> = {
  light: {
    eyebrow: "text-secondary-600",
    title: "text-primary-900",
    description: "text-muted",
  },
  dark: {
    eyebrow: "text-secondary-400",
    title: "text-white",
    description: "text-white/80",
  },
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  tone = "light",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  tone?: Tone;
}) {
  const alignment = align === "center" ? "text-center items-center mx-auto" : "text-left items-start";
  const colors = toneClasses[tone];

  return (
    <div className={`flex flex-col gap-3 max-w-2xl ${alignment}`}>
      {eyebrow ? (
        <span className={`text-sm font-semibold tracking-[0.18em] uppercase ${colors.eyebrow}`}>
          {eyebrow}
        </span>
      ) : null}
      <h2 className={`font-display text-3xl sm:text-4xl font-medium text-balance ${colors.title}`}>
        {title}
      </h2>
      {description ? (
        <p className={`text-base sm:text-lg text-balance ${colors.description}`}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
