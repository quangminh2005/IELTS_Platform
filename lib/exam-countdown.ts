import { vnDateKey } from "@/lib/attendance";
import { VN_OFFSET_MS } from "@/lib/streak";

// Ngày thi IELTS của học viên + đếm ngược (ý tưởng từ YouPass, 16/10/2026).
//
// StudentProfile.examDate lưu mốc 0h giờ VN của ngày thi — chỉ ngày là có nghĩa,
// giờ không dùng. Mọi phép đếm đi qua khoá ngày "YYYY-MM-DD" giờ VN, nên 23h30
// tối hôm trước vẫn là "còn 1 ngày" chứ không phải "còn 0 ngày".
//
// Module thuần: không đụng Prisma, không đụng React.

const DAY_MS = 24 * 60 * 60 * 1000;
// Ngày thi xa nhất / cũ nhất được nhận — chặn gõ nhầm năm (2062, 1026…).
const MAX_DAYS_AHEAD = 3 * 365;
const MAX_DAYS_BEHIND = 365;
// Từ ngưỡng này trở xuống thì gọi là "sắp thi" (đổi màu thẻ).
const SOON_DAYS = 14;

// Số ngày kể từ 1/1/1970 của một khoá "YYYY-MM-DD" — để trừ hai ngày cho nhau.
function dayNumber(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

// Giá trị từ <input type="date"> ("YYYY-MM-DD"). Rỗng -> null (xoá ngày thi).
// Sai định dạng / ngày không có thật / quá xa -> ném lỗi tiếng Việt cho form.
export function parseExamDateInput(raw: string, now: Date): Date | null {
  const text = raw.trim();
  if (text.length === 0) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) {
    throw new Error("Ngày thi không hợp lệ.");
  }

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const utcMidnight = Date.UTC(year, month - 1, day);
  const check = new Date(utcMidnight);
  // Date.UTC tự "tràn" 30/2 thành 2/3 — so lại để bắt ngày không có thật.
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new Error("Ngày thi không hợp lệ.");
  }

  const diff = dayNumber(text) - dayNumber(vnDateKey(now));
  if (diff > MAX_DAYS_AHEAD) {
    throw new Error("Ngày thi xa quá — hãy kiểm tra lại năm.");
  }
  if (diff < -MAX_DAYS_BEHIND) {
    throw new Error("Ngày thi đã qua hơn một năm — hãy kiểm tra lại năm.");
  }

  return new Date(utcMidnight - VN_OFFSET_MS);
}

// Giá trị đổ vào <input type="date">; null -> "".
export function examDateInputValue(examDate: Date | null | undefined): string {
  return examDate ? vnDateKey(examDate) : "";
}

// Số ngày lịch (giờ VN) từ hôm nay tới ngày thi: 0 = hôm nay, âm = đã qua.
export function daysUntilExam(examDate: Date, now: Date): number {
  return dayNumber(vnDateKey(examDate)) - dayNumber(vnDateKey(now));
}

export type ExamCountdown = {
  state: "upcoming" | "soon" | "today" | "past";
  days: number;
  // "khoảng 7 tuần" — chỉ có khi còn trên 2 tuần, gần hơn thì đếm ngày là đủ.
  weeksText: string | null;
  // "05/12/2026"
  dateText: string;
};

export function examCountdown(examDate: Date | null | undefined, now: Date): ExamCountdown | null {
  if (!examDate) {
    return null;
  }

  const days = daysUntilExam(examDate, now);
  const [year, month, day] = vnDateKey(examDate).split("-");
  const state = days < 0 ? "past" : days === 0 ? "today" : days <= SOON_DAYS ? "soon" : "upcoming";

  return {
    state,
    days,
    weeksText: days > SOON_DAYS ? `khoảng ${Math.round(days / 7)} tuần` : null,
    dateText: `${day}/${month}/${year}`
  };
}
