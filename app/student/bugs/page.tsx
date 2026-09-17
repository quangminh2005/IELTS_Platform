import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { bugCategoryLabel, formatBugContext, parseBugContext } from "@/lib/bug-report";
import { formatRelativeTime } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function StudentBugsPage() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "student") {
    redirect("/login");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });

  if (!student) {
    redirect("/waiting");
  }

  const reports = await prisma.bugReport.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      category: true,
      description: true,
      imageUrl: true,
      contextJson: true,
      status: true,
      teacherNote: true,
      resolvedAt: true,
      createdAt: true
    }
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Hỗ trợ</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Báo lỗi đã gửi</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Gặp trục trặc ở bất kỳ trang nào, bấm nút con bọ ở góc màn hình để báo cho cô/thầy.
        </p>
      </header>

      {reports.length === 0 ? (
        <section className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Bạn chưa gửi báo lỗi nào.{" "}
          <Link href="/student" className="font-medium text-primary hover:underline">
            Về tổng quan
          </Link>
        </section>
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => {
            const resolved = report.status === "resolved";
            const contextLine = formatBugContext(parseBugContext(report.contextJson));
            return (
              <li key={report.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold">
                    {bugCategoryLabel(report.category)}
                  </span>
                  <span
                    className={
                      resolved
                        ? "rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                        : "rounded-full border border-amber-400/50 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300"
                    }
                  >
                    {resolved ? "Đã xử lý" : "Đang chờ"}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground" suppressHydrationWarning>
                    {formatRelativeTime(report.createdAt)}
                  </span>
                </div>
                {contextLine ? (
                  <p className="mt-2 text-xs text-muted-foreground">Vị trí: {contextLine}</p>
                ) : null}
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{report.description}</p>
                {report.imageUrl ? (
                  <a href={report.imageUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={report.imageUrl}
                      alt="Ảnh đính kèm"
                      className="h-24 w-24 rounded-lg border border-border object-cover"
                    />
                  </a>
                ) : null}
                {resolved ? (
                  <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      Phản hồi của giáo viên
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-foreground">
                      {report.teacherNote?.trim() ? report.teacherNote : "Đã xử lý, cảm ơn bạn đã báo."}
                    </p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
