import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ProgressLineChart } from "@/components/progress-line-chart";
import { StudentAvatar } from "@/components/student-avatar";
import { formatBand } from "@/lib/band-score";
import {
  buildParentSummary,
  isItemLate,
  pickStrengthsAndWeaknesses,
  type ParentReportItem
} from "@/lib/parent-report";
import {
  findStudentByParentToken,
  loadParentReportItems,
  loadParentStatsData
} from "@/lib/parent-report-query";
import { buildProgressSeries, questionTypeStatsBySkill } from "@/lib/question-stats";
import { distinctSkills, SKILL_LABELS } from "@/lib/skills";

// generateMetadata và trang cùng tra học viên theo token — cache() để chỉ hỏi DB một lần.
const getStudent = cache(findStudentByParentToken);

// Dữ liệu thay đổi mỗi khi cô chấm bài; không cache.
export const dynamic = "force-dynamic";

type ParentPageProps = {
  params: { token: string };
};

const DATE_FORMAT = new Intl.DateTimeFormat("vi-VN", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh"
});

// Tiêu đề riêng cho từng học viên: dán link vào Zalo/Messenger thì khung xem trước
// hiện "Báo cáo học tập – <tên>" thay vì tên chung của web, phụ huynh nhận ra ngay.
// Trang công khai theo link bí mật — không được để công cụ tìm kiếm đánh chỉ mục.
export async function generateMetadata({ params }: ParentPageProps): Promise<Metadata> {
  const student = await getStudent(params.token);
  const robots = { index: false, follow: false };

  if (!student) {
    return { title: "Link báo cáo không còn hiệu lực", robots };
  }

  const title = `Báo cáo học tập – ${student.displayName}`;
  const description = "Bài đã làm, điểm số, tiến bộ và nhận xét của giáo viên.";

  return {
    title,
    description,
    robots,
    openGraph: { title, description, type: "website", locale: "vi_VN" }
  };
}

function formatDate(value: Date | null): string {
  return value ? DATE_FORMAT.format(value) : "—";
}

function skillsLabel(skills: string[]): string {
  return distinctSkills(skills)
    .map((skill) => SKILL_LABELS[skill] ?? skill)
    .join(", ");
}

// Điểm hiển thị cho một bài: Nghe/Đọc ra %, Viết/Nói ra band, chưa chấm ghi rõ.
function scoreLabel(item: ParentReportItem): string {
  if (item.scorePercent !== null) {
    return `${Math.round(item.scorePercent)}%`;
  }

  if (item.overallBand !== null) {
    return `Band ${formatBand(item.overallBand)}`;
  }

  return "Chờ cô chấm";
}

function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-card">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      {note ? <p className="mt-0.5 text-xs font-medium text-red-600 dark:text-red-400">{note}</p> : null}
    </div>
  );
}

export default async function ParentReportPage({ params }: ParentPageProps) {
  const student = await getStudent(params.token);

  if (!student) {
    notFound();
  }

  const [items, stats] = await Promise.all([
    loadParentReportItems(student.id),
    loadParentStatsData(student.id)
  ]);

  const summary = buildParentSummary(items, new Date(), "month");
  const series = buildProgressSeries(stats.series);
  const groups = questionTypeStatsBySkill(stats.answers);
  const { strengths, weaknesses } = pickStrengthsAndWeaknesses(groups.all);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 text-[15px]">
      <header>
        <p className="text-sm font-semibold text-primary">Báo cáo học tập</p>
        <div className="mt-2 flex items-center gap-3">
          <StudentAvatar
            avatarUrl={student.avatarUrl}
            avatarPreset={student.avatarPreset}
            userImage={student.userImage}
            displayName={student.displayName}
            size="lg"
          />
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {student.displayName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {student.className ? `Lớp ${student.className}` : "Chưa xếp lớp"}
              {student.targetBand !== null
                ? ` · Mục tiêu band ${formatBand(student.targetBand)}`
                : ""}
            </p>
          </div>
        </div>
        <p className="mt-3 rounded-lg bg-muted px-4 py-3 text-sm leading-6">{summary.headline}</p>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <StatCard
          label="Bài đã hoàn thành (30 ngày)"
          value={String(summary.submittedCount)}
          note={
            summary.lateSubmittedCount > 0
              ? `${summary.lateSubmittedCount} bài nộp trễ hạn`
              : undefined
          }
        />
        <StatCard label="Bài quá hạn chưa làm" value={String(summary.lateOrMissingCount)} />
        <StatCard
          label="Điểm trung bình"
          value={summary.averagePercent === null ? "—" : `${Math.round(summary.averagePercent)}%`}
        />
        <StatCard
          label="Band Viết/Nói gần đây"
          value={summary.averageBand === null ? "—" : formatBand(summary.averageBand)}
        />
      </section>

      {series.listening.length > 0 || series.reading.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Tiến bộ theo thời gian</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Tỷ lệ câu đúng của các bài Nghe và Đọc đã nộp.
            </p>
          </div>
          <ProgressLineChart listening={series.listening} reading={series.reading} />
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Các bài đã làm</h2>
        </div>
        {summary.done.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Chưa có bài nào được nộp trong 30 ngày qua.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {summary.done.map((item, index) => (
              <li key={`${item.assignmentTitle}-${index}`} className="px-5 py-3">
                <p className="font-medium">{item.assignmentTitle}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {skillsLabel(item.skills)} · nộp {formatDate(item.submittedAt)} ·{" "}
                  <span className="font-semibold text-foreground">{scoreLabel(item)}</span>
                </p>
                {isItemLate(item) ? (
                  <p className="mt-1">
                    <span className="inline-block rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
                      Nộp trễ (hạn {formatDate(item.deadline)})
                    </span>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {summary.pending.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Bài quá hạn chưa làm</h2>
          </div>
          <ul className="divide-y divide-border">
            {summary.pending.map((item, index) => (
              <li key={`${item.assignmentTitle}-${index}`} className="px-5 py-3">
                <p className="font-medium">{item.assignmentTitle}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {skillsLabel(item.skills)} · hạn {formatDate(item.deadline)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {summary.comments.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Nhận xét của giáo viên</h2>
          </div>
          <ul className="divide-y divide-border">
            {summary.comments.map((comment, index) => (
              <li key={`${comment.assignmentTitle}-${index}`} className="px-5 py-4">
                <p className="text-sm font-medium">
                  {comment.assignmentTitle}
                  {comment.band !== null ? ` · Band ${formatBand(comment.band)}` : ""}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm leading-6">{comment.feedback}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {strengths.length > 0 || weaknesses.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Dạng câu làm tốt và cần luyện thêm</h2>
          </div>
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Làm tốt
              </p>
              {strengths.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Chưa đủ dữ liệu</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {strengths.map((stat) => (
                    <li key={stat.key}>
                      {stat.label} — {stat.percent}%
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cần luyện thêm
              </p>
              {weaknesses.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Chưa đủ dữ liệu</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {weaknesses.map((stat) => (
                    <li key={stat.key}>
                      {stat.label} — {stat.percent}%
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <footer className="pb-8 text-center text-xs text-muted-foreground">
        Trang này chỉ dành riêng cho phụ huynh, vui lòng không chia sẻ đường link.
      </footer>
    </main>
  );
}
