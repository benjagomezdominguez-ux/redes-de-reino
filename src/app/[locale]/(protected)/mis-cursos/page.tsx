import { getTranslations, setRequestLocale, getFormatter } from "next-intl/server";
import { NavbarWithAuth } from "@/components/sections/NavbarWithAuth";
import { Footer } from "@/components/sections/Footer";
import { Container } from "@/components/ui/Container";
import { Link } from "@/i18n/navigation";
import { getMyCourses } from "@/lib/courses/student-queries";

export default async function MyCoursesPage({
  params,
}: PageProps<"/[locale]/mis-cursos">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("courses");
  const format = await getFormatter();

  const entries = await getMyCourses();

  return (
    <>
      <NavbarWithAuth />
      <main className="flex-1 py-20 sm:py-28">
        <Container className="mx-auto flex max-w-3xl flex-col gap-10">
          <h1 className="font-display text-3xl font-medium text-primary-900">{t("myCourses.title")}</h1>

          {entries.length === 0 ? (
            <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="w-full text-center text-muted">{t("myCourses.empty")}</p>
              <Link
                href="/cursos"
                className="mx-auto inline-flex items-center justify-center rounded-full bg-primary-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
              >
                {t("myCourses.browseLink")}
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-5">
              {entries.map((entry) => {
                const total = entry.meetings.length;
                const attended = entry.meetings.filter((m) => entry.attendedMeetingIds.has(m.id)).length;

                return (
                  <li
                    key={entry.course.id}
                    className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6 shadow-soft"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h2 className="font-display text-lg font-medium text-primary-900">{entry.course.title}</h2>
                      {entry.enrollmentStatus === "cancelled" ? (
                        <span className="shrink-0 rounded-full bg-muted/20 px-3 py-1 text-xs font-medium text-muted">
                          {t("myCourses.cancelled")}
                        </span>
                      ) : null}
                    </div>

                    {total === 0 ? (
                      <p className="text-sm text-muted">{t("myCourses.noMeetingsYet")}</p>
                    ) : (
                      <p className="text-sm text-text">
                        {t("myCourses.attendanceSummary", { attended, total })}
                      </p>
                    )}

                    <p className="text-xs text-muted">
                      {format.dateTime(new Date(entry.enrolledAt), { dateStyle: "medium" })}
                    </p>

                    <Link
                      href={`/cursos/${entry.course.slug}`}
                      className="mt-1 w-fit text-sm font-semibold text-primary-900 underline"
                    >
                      {t("myCourses.viewDetail")}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Container>
      </main>
      <Footer />
    </>
  );
}
