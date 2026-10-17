export type CourseStatus = "draft" | "published" | "closed" | "archived";

export type Course = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  status: CourseStatus;
  enrollment_open: boolean;
  attendance_enabled: boolean;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type CourseMeeting = {
  id: string;
  course_id: string;
  title: string;
  scheduled_at: string | null;
  position: number;
  attendance_enabled: boolean;
};

export type EnrollmentStatus = "active" | "cancelled";
