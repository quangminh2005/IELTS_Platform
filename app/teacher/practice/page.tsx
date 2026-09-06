import Link from "next/link";
import { PracticeProgressTable } from "@/components/practice-progress-table";
import { formatDuration } from "@/lib/format-duration";
import { onlyPracticeAssignment } from "@/lib/practice";
import {
  buildPracticeStudentRows,
  parsePracticeRange,
  parsePracticeSort,
  practiceRangeStart,
  practiceTotals,
  PRACTICE_RANGES,
  PRACTICE_RANGE_LABELS
} from "@/lib/practice-progress";
import { prisma } from "@/lib/prisma";
import { requireTeacherPage } from "@/lib/teacher-page";

type TeacherPracticePageProps = {
  searchParams?: {
    classId?: string;
    range?: string;
    sort?: string;
  };
};

// Chuỗi "tất cả lớp" trên URL. Rỗng cũng được hiểu là tất cả.
const ALL_CLASSES = "all";

export default async function TeacherPracticePage({ searchParams }: TeacherPracticePageProps) {
  const teacher = await requireTeacherPage();

  const range = parsePracticeRange(searchParams?.range);
  const sort = parsePracticeSort(searchParams?.sort);
  const now = new Date();
  const rangeStart = practiceRangeStart(range, now);

  const classes = await prisma.class.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true }
  });

  // Chỉ nhận classId nằm trong danh sách đã lọc theo teacherId — id lạ hoặc lớp của
  // giáo viên khác đều rơi về "tất cả lớp", không có đường xem lớp người khác.
  const selectedClassId =
    classes.find((classItem) => classItem.id === searchParams?.classId)?.id ?? null;

  const students = await prisma.studentProfile.findMany({
    where: {
      classes: {
        some: {
          class: selectedClassId
            ? { id: selectedClassId, teacherId: teacher.id }
            : { teacherId: teacher.id }
        }
      }
    },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      avatarPreset: true,
      user: { select: { image: true } }
    }
  });

  // Lượt tự luyện ĐÃ NỘP của đúng nhóm học viên đang xem. Không kéo answers —
  // bảng này chỉ cần thời gian, điểm % và khoá phạm vi.
  const attempts =
    students.length > 0
      ? await prisma.attempt.findMany({
          where: {
            studentId: { in: students.map((student) => student.id) },
            status: { in: ["submitted", "reviewed"] },
            assignmentRecipient: {
              assignment: { teacherId: teacher.id, ...onlyPracticeAssignment }
            },
            // Lượt đã nộp luôn có submittedAt; nhánh startedAt chỉ là lưới an toàn
            // cho dữ liệu cũ, để lượt đó không rơi khỏi khoảng thống kê.
            ...(rangeStart
              ? {
                  OR: [
                    { submittedAt: { gte: rangeStart } },
                    { submittedAt: null, startedAt: { gte: rangeStart } }
                  ]
                }
              : {})
          },
          select: {
            studentId: true,
            startedAt: true,
            submittedAt: true,
            elapsedSeconds: true,
            scorePercent: true,
            assignmentRecipient: {
              select: { assignment: { select: { practiceScopeKey: true } } }
            }
          }
        })
      : [];

  const rows = buildPracticeStudentRows(
    students.map((student) => ({
      id: student.id,
      displayName: student.displayName,
      avatarUrl: student.avatarUrl,
      avatarPreset: student.avatarPreset,
      userImage: student.user?.image ?? null
    })),
    attempts.map((attempt) => ({
      studentId: attempt.studentId,
      practiceScopeKey: attempt.assignmentRecipient.assignment.practiceScopeKey,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      elapsedSeconds: attempt.elapsedSeconds,
      scorePercent: attempt.scorePercent
    })),
    { sort, now }
  );

  const totals = practiceTotals(rows);

  const header = (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-sm font-semibold text-primary">Học viên luyện thêm</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Tự luyện</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Ai đang tự luyện đề trong thư viện, ai đã lâu không đụng đến. Số liệu tính mọi lượt
          luyện, kể cả lượt luyện lại cùng một đề.
        </p>
      </div>

      <form method="get" className="flex shrink-0 flex-wrap items-end gap-2">
        <input type="hidden" name="sort" value={sort} />
        <label className="block text-sm font-medium">
          <span className="mb-2 block">Lớp</span>
          <select
            name="classId"
            defaultValue={selectedClassId ?? ALL_CLASSES}
            className="w-44 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
          >
            <option value={ALL_CLASSES}>Tất cả lớp</option>
            {classes.map((classItem) => (
              <option key={classItem.id} value={classItem.id}>
                {classItem.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          <span className="mb-2 block">Khoảng thời gian</span>
          <select
            name="range"
            defaultValue={range}
            className="w-44 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
          >
            {PRACTICE_RANGES.map((item) => (
              <option key={item} value={item}>
                {PRACTICE_RANGE_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
        >
          Xem
        </button>
      </form>
    </header>
  );

  if (rows.length === 0) {
    return (
      <div className="space-y-8">
        {header}
        <div className="rounded-xl border border-border bg-card px-5 py-12 text-center shadow-card">
          <p className="text-sm font-medium">Chưa có học viên nào trong lớp</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Thêm học viên vào lớp để theo dõi việc tự luyện của các em.
          </p>
          <Link
            href="/teacher/classes"
            className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
          >
            Tới trang Lớp học
          </Link>
        </div>
      </div>
    );
  }

  const cards = [
    {
      label: "Lượt luyện",
      value: String(totals.rounds),
      note: PRACTICE_RANGE_LABELS[range],
      accent: "text-primary"
    },
    {
      label: "Có tự luyện",
      value: `${totals.activeStudents}/${totals.totalStudents}`,
      note: "Học viên trong danh sách",
      accent: "text-emerald-600 dark:text-emerald-300"
    },
    {
      label: "Tổng thời gian",
      value: totals.totalSeconds > 0 ? formatDuration(totals.totalSeconds) : "—",
      note: "Cả nhóm cộng lại",
      accent: "text-blue-600 dark:text-blue-300"
    }
  ];

  return (
    <div className="space-y-8">
      {header}

      <section className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {card.label}
            </p>
            <p className={`mt-2 text-2xl font-bold tabular-nums ${card.accent}`}>{card.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{card.note}</p>
          </div>
        ))}
      </section>

      <PracticeProgressTable rows={rows} sort={sort} range={range} classId={selectedClassId} />

      <p className="text-xs text-muted-foreground">
        Chỉ tính lượt đã nộp. Điểm trung bình lấy từ bài Nghe/Đọc chấm tự động — bài Viết/Nói
        chờ chấm không có phần trăm nên không tính vào đây.
      </p>
    </div>
  );
}
