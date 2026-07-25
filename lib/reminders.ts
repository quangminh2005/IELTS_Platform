import { SKILL_LABELS, distinctSkills } from "@/lib/skills";

// Một bài đang chờ làm của một học sinh — vừa đủ dữ liệu để quyết định có nhắc
// hay không và để soạn mail. Cố tình KHÔNG phụ thuộc kiểu của Prisma để toàn bộ
// logic dưới đây test được mà không cần DB.
export type ReminderCandidate = {
  recipientId: string;
  studentEmail: string;
  studentName: string;
  assignmentTitle: string;
  skills: string[];
  deadline: Date | null;
  status: string;
  reminderSentAt: Date | null;
};

// Một mail gộp cho một học sinh.
export type StudentReminder = {
  email: string;
  name: string;
  items: ReminderCandidate[];
  recipientIds: string[];
};

const DEFAULT_WINDOW_HOURS = 24;
const HOUR_MS = 60 * 60 * 1000;

// Trạng thái được coi là "chưa nộp" — khớp với RecipientStatus trong schema.
const PENDING_STATUSES = new Set(["assigned", "in_progress"]);

// Nơi DUY NHẤT định nghĩa "thế nào là một bài cần nhắc".
export function findDueReminders(
  candidates: ReminderCandidate[],
  now: Date,
  windowHours: number = DEFAULT_WINDOW_HOURS
): ReminderCandidate[] {
  const from = now.getTime();
  const to = from + windowHours * HOUR_MS;

  return candidates.filter((candidate) => {
    if (!candidate.deadline) {
      return false;
    }

    if (candidate.reminderSentAt) {
      return false;
    }

    if (!PENDING_STATUSES.has(candidate.status)) {
      return false;
    }

    const deadline = candidate.deadline.getTime();
    return deadline > from && deadline <= to;
  });
}

// Gộp theo email học sinh: mỗi em đúng một mail, bài nào gần hết hạn xếp trước.
export function groupRemindersByStudent(due: ReminderCandidate[]): StudentReminder[] {
  const byEmail = new Map<string, StudentReminder>();

  for (const item of due) {
    const existing = byEmail.get(item.studentEmail);

    if (existing) {
      existing.items.push(item);
    } else {
      byEmail.set(item.studentEmail, {
        email: item.studentEmail,
        name: item.studentName,
        items: [item],
        recipientIds: [],
      });
    }
  }

  const reminders = [...byEmail.values()];

  for (const reminder of reminders) {
    reminder.items.sort((a, b) => deadlineTime(a) - deadlineTime(b));
    reminder.recipientIds = reminder.items.map((item) => item.recipientId);
  }

  return reminders;
}

// findDueReminders đã lọc bỏ deadline null, nên ở đây luôn có giá trị.
function deadlineTime(candidate: ReminderCandidate): number {
  return candidate.deadline ? candidate.deadline.getTime() : 0;
}

const VN_OFFSET_MS = 7 * HOUR_MS;

// Dịch mốc thời gian sang giờ VN rồi cắt chuỗi ISO. Kết quả CHỈ dùng để hiển thị
// và để so sánh ngày — không phải mốc UTC thật, đừng new Date() lại.
function vnDateKey(date: Date): string {
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

function vnClock(date: Date): string {
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(11, 16);
}

// "23:59 hôm nay" / "18:00 ngày mai" / "18:00 ngày 28/07" — dễ đọc hơn ngày đầy đủ.
export function formatDeadlineLabel(deadline: Date, now: Date): string {
  const clock = vnClock(deadline);
  const day = vnDateKey(deadline);
  const today = vnDateKey(now);
  const tomorrow = vnDateKey(new Date(now.getTime() + 24 * HOUR_MS));

  if (day === today) {
    return `${clock} hôm nay`;
  }

  if (day === tomorrow) {
    return `${clock} ngày mai`;
  }

  const [, month, dayOfMonth] = day.split("-");
  return `${clock} ngày ${dayOfMonth}/${month}`;
}

// Tên bài do giáo viên tự đặt nên có thể chứa <, &, " — phải escape trước khi
// nhúng vào HTML, không thì mail vỡ cấu trúc.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function skillLabel(skills: string[]): string {
  return distinctSkills(skills)
    .map((skill) => SKILL_LABELS[skill])
    .join(", ");
}

export function buildReminderEmail(
  reminder: StudentReminder,
  appUrl: string,
  now: Date
): { subject: string; html: string; text: string } {
  const count = reminder.items.length;
  const link = `${appUrl.replace(/\/+$/, "")}/student`;

  const subject =
    count === 1
      ? `Nhắc bài: "${reminder.items[0].assignmentTitle}" sắp hết hạn`
      : `Nhắc bài: ${count} bài IELTS sắp hết hạn`;

  const intro =
    count === 1
      ? "Em còn 1 bài chưa làm, sắp hết hạn:"
      : `Em còn ${count} bài chưa làm, sắp hết hạn:`;

  const rows = reminder.items.map((item) => ({
    title: item.assignmentTitle,
    skills: skillLabel(item.skills),
    deadline: item.deadline ? formatDeadlineLabel(item.deadline, now) : "",
  }));

  const text = [
    `Chào ${reminder.name},`,
    "",
    intro,
    "",
    ...rows.map(
      (row) => `• ${row.title}${row.skills ? ` (${row.skills})` : ""} — hết hạn ${row.deadline}`
    ),
    "",
    `Vào làm bài: ${link}`,
    "",
    "Mail này được gửi tự động từ lớp IELTS.",
  ].join("\n");

  const itemsHtml = rows
    .map((row) => {
      const skills = row.skills
        ? ` <span style="color:#64748b">(${escapeHtml(row.skills)})</span>`
        : "";
      return `<li style="margin:0 0 10px"><strong>${escapeHtml(row.title)}</strong>${skills}<br><span style="color:#64748b">hết hạn ${escapeHtml(row.deadline)}</span></li>`;
    })
    .join("");

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#0f172a">
  <p>Chào ${escapeHtml(reminder.name)},</p>
  <p>${escapeHtml(intro)}</p>
  <ul style="padding-left:20px;margin:0">${itemsHtml}</ul>
  <p style="margin:24px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">Vào làm bài</a></p>
  <p style="color:#64748b;font-size:13px">Mail này được gửi tự động từ lớp IELTS.</p>
</div>`;

  return { subject, html, text };
}
