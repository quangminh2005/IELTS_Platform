import { formatBand } from "@/lib/band-score";
import type { ParentReportItem, ParentSummary } from "@/lib/parent-report";
import { distinctSkills, SKILL_LABELS } from "@/lib/skills";

// Soạn mail báo cáo gửi phụ huynh. Hàm thuần — số liệu đã được tính sẵn ở
// lib/parent-report.ts, ở đây chỉ lo diễn đạt.

export type ParentEmailInput = {
  studentName: string;
  parentName: string | null;
  summary: ParentSummary;
  link: string;
};

// Tên bài do giáo viên tự đặt nên có thể chứa <, &, " — phải escape trước khi
// nhúng vào HTML, không thì mail vỡ cấu trúc.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const DATE_FORMAT = new Intl.DateTimeFormat("vi-VN", {
  day: "numeric",
  month: "numeric",
  timeZone: "Asia/Ho_Chi_Minh"
});

function skillsLabel(skills: string[]): string {
  return distinctSkills(skills)
    .map((skill) => SKILL_LABELS[skill] ?? skill)
    .join(", ");
}

function scoreLabel(item: ParentReportItem): string {
  if (item.scorePercent !== null) {
    return `${Math.round(item.scorePercent)}%`;
  }

  if (item.overallBand !== null) {
    return `Band ${formatBand(item.overallBand)}`;
  }

  return "chờ cô chấm";
}

function greeting(parentName: string | null): string {
  const name = parentName?.trim();
  return name ? `Kính gửi ${name},` : "Kính gửi phụ huynh,";
}

function htmlList(lines: string[]): string {
  return `<ul style="padding-left:20px;margin:0">${lines
    .map((line) => `<li style="margin:0 0 8px">${escapeHtml(line)}</li>`)
    .join("")}</ul>`;
}

function htmlSection(title: string, lines: string[]): string {
  if (lines.length === 0) {
    return "";
  }

  return `<h3 style="margin:24px 0 8px;font-size:15px">${escapeHtml(title)}</h3>${htmlList(lines)}`;
}

function textSection(title: string, lines: string[]): string[] {
  return lines.length === 0 ? [] : ["", `${title}:`, ...lines.map((line) => `• ${line}`)];
}

export function buildParentReportEmail(input: ParentEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const { studentName, parentName, summary, link } = input;
  const periodLabel = summary.period === "week" ? "tuần" : "tháng";
  const subject = `Báo cáo học tập ${periodLabel} của ${studentName}`;

  const doneLines = summary.done.map(
    (item) => `${item.assignmentTitle} (${skillsLabel(item.skills)}) — ${scoreLabel(item)}`
  );

  const pendingLines = summary.pending.map(
    (item) =>
      `${item.assignmentTitle} — hạn ${item.deadline ? DATE_FORMAT.format(item.deadline) : "không rõ"}`
  );

  const commentLines = summary.comments.map(
    (comment) =>
      `${comment.assignmentTitle}${comment.band !== null ? ` (Band ${formatBand(comment.band)})` : ""}: ${comment.feedback}`
  );

  const text = [
    greeting(parentName),
    "",
    summary.headline,
    ...textSection("Các bài đã làm", doneLines),
    ...textSection("Bài quá hạn chưa làm", pendingLines),
    ...textSection("Nhận xét của giáo viên", commentLines),
    "",
    `Xem chi tiết: ${link}`,
    "",
    "Mail này được gửi tự động từ lớp IELTS. Phụ huynh có thể trả lời mail này để liên hệ với giáo viên."
  ].join("\n");

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#0f172a">
  <p>${escapeHtml(greeting(parentName))}</p>
  <p>${escapeHtml(summary.headline)}</p>
  ${htmlSection("Các bài đã làm", doneLines)}
  ${htmlSection("Bài quá hạn chưa làm", pendingLines)}
  ${htmlSection("Nhận xét của giáo viên", commentLines)}
  <p style="margin:24px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">Xem chi tiết tình hình học tập</a></p>
  <p style="color:#64748b;font-size:13px">Mail này được gửi tự động từ lớp IELTS. Phụ huynh có thể trả lời mail này để liên hệ với giáo viên.</p>
</div>`;

  return { subject, text, html };
}
