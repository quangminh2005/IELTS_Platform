import Link from "next/link";
import { BugReportTeacherRow, type TeacherBugReportRow } from "@/components/bug-report-teacher-row";
import { describeDevice, formatBugContext, parseBugContext } from "@/lib/bug-report";
import { prisma } from "@/lib/prisma";
import { requireTeacherPage } from "@/lib/teacher-page";

export const dynamic = "force-dynamic";

type TeacherBugsPageProps = { searchParams?: { tab?: string } };

const tabClass =
  "rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:border-primary";
const activeTabClass =
  "rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary";

function loadReports(
  status: "open" | "resolved",
  scope: { student: { classes: { some: { class: { teacherId: string } } } } }
) {
  return prisma.bugReport.findMany({
    where: { status, ...scope },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      category: true,
      description: true,
      imageUrl: true,
      pageUrl: true,
      userAgent: true,
      viewport: true,
      attemptId: true,
      contextJson: true,
      status: true,
      teacherNote: true,
      resolvedAt: true,
      createdAt: true,
      student: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          avatarPreset: true,
          user: { select: { image: true } },
          classes: { select: { class: { select: { name: true } } } }
        }
      }
    }
  });
}

export default async function TeacherBugsPage({ searchParams }: TeacherBugsPageProps) {
  const teacher = await requireTeacherPage();
  const tab = searchParams?.tab === "resolved" ? "resolved" : "open";
  const scope = { student: { classes: { some: { class: { teacherId: teacher.id } } } } };

  // Bọc try/catch: bảng BugReport mới, nếu ensure-db chưa chạy trên prod thì trang
  // hiện rỗng thay vì màn hình lỗi.
  let reports: Awaited<ReturnType<typeof loadReports>> = [];
  let openCount = 0;
  let resolvedCount = 0;
  try {
    [reports, openCount, resolvedCount] = await Promise.all([
      loadReports(tab, scope),
      prisma.bugReport.count({ where: { status: "open", ...scope } }),
      prisma.bugReport.count({ where: { status: "resolved", ...scope } })
    ]);
  } catch (error) {
    console.error("[bao-loi] Không đọc được BugReport:", error);
  }

  // Xác minh bài làm còn tồn tại và đúng học viên; chỉ link khi đã nộp (trang
  // /teacher/results chỉ mở bài submitted/reviewed).
  const attemptIds = reports.flatMap((r) => (r.attemptId ? [r.attemptId] : []));
  const attempts = attemptIds.length
    ? await prisma.attempt.findMany({
        where: { id: { in: attemptIds } },
        select: {
          id: true,
          studentId: true,
          status: true,
          assignmentRecipient: { select: { assignment: { select: { title: true } } } }
        }
      })
    : [];
  const attemptById = new Map(attempts.map((a) => [a.id, a]));

  const rows: TeacherBugReportRow[] = reports.map((report) => {
    const attempt = report.attemptId ? attemptById.get(report.attemptId) : undefined;
    const ownAttempt = attempt && attempt.studentId === report.student.id ? attempt : undefined;
    return {
      id: report.id,
      category: report.category,
      description: report.description,
      imageUrl: report.imageUrl,
      pageUrl: report.pageUrl,
      device: describeDevice(report.userAgent),
      viewport: report.viewport,
      contextLine: formatBugContext(parseBugContext(report.contextJson)),
      attemptTitle: ownAttempt?.assignmentRecipient.assignment.title ?? null,
      attemptHref:
        ownAttempt && (ownAttempt.status === "submitted" || ownAttempt.status === "reviewed")
          ? `/teacher/results/${ownAttempt.id}`
          : null,
      status: report.status,
      teacherNote: report.teacherNote,
      createdAt: report.createdAt.toISOString(),
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
      student: {
        displayName: report.student.displayName,
        avatarUrl: report.student.avatarUrl,
        avatarPreset: report.student.avatarPreset,
        userImage: report.student.user?.image ?? null,
        classNames: report.student.classes.map((c) => c.class.name)
      }
    };
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Hỗ trợ học viên</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Báo lỗi</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Học viên bấm nút con bọ trên web để báo trục trặc. Trang, thiết bị và bài đang làm được gửi kèm tự động.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        <Link href="/teacher/bugs" className={tab === "open" ? activeTabClass : tabClass}>
          Mới ({openCount})
        </Link>
        <Link href="/teacher/bugs?tab=resolved" className={tab === "resolved" ? activeTabClass : tabClass}>
          Đã xử lý ({resolvedCount})
        </Link>
      </nav>

      {rows.length === 0 ? (
        <section className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {tab === "open" ? "Không có báo lỗi nào đang chờ." : "Chưa có báo lỗi nào được xử lý."}
        </section>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <BugReportTeacherRow key={row.id} report={row} />
          ))}
        </div>
      )}
    </div>
  );
}
