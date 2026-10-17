import { getTranslations, setRequestLocale } from "next-intl/server";
import { NavbarWithAuth } from "@/components/sections/NavbarWithAuth";
import { Footer } from "@/components/sections/Footer";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StaggerGrid } from "@/components/ui/motion/StaggerGrid";
import { CourseCard } from "@/components/ui/CourseCard";
import { getPublicCourses, getPublicEnrollmentCounts } from "@/lib/courses/queries";

export default async function CoursesPage({
  params,
}: PageProps<"/[locale]/cursos">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("courses");

  const [courses, enrollmentCounts] = await Promise.all([getPublicCourses(), getPublicEnrollmentCounts()]);

  return (
    <>
      <NavbarWithAuth />
      <main className="flex-1 py-20 sm:py-28">
        <Container className="flex flex-col gap-12">
          <SectionHeading align="center" eyebrow={t("eyebrow")} title={t("title")} description={t("intro")} />

          {courses.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
              {t("empty")}
            </p>
          ) : (
            <StaggerGrid className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} enrolledCount={enrollmentCounts.get(course.id) ?? 0} />
              ))}
            </StaggerGrid>
          )}
        </Container>
      </main>
      <Footer />
    </>
  );
}
