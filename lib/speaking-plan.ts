// Lập dàn ý trước khi nói (Speaking): học viên có N giây chuẩn bị, viết dàn ý vào
// một ô; hết giờ thì ô khoá lại. Các hàm ở đây là hàm thuần — dùng chung cho server
// action (quyết định còn nhận chữ không), trang làm bài và trang chấm của giáo viên.

// Thời gian chuẩn bị tính bằng GIÂY (Assignment.speakingPrepSeconds) để giao được
// 30 giây/câu cho Part 1. Bài giao cũ chỉ có speakingPrepMinutes — đọc qua
// assignmentPrepSeconds().
export const SPEAKING_PREP_MIN_SECONDS = 15;
export const SPEAKING_PREP_MAX_SECONDS = 600;
export const SPEAKING_PREP_DEFAULT_SECONDS = 60;
// Cho lần lưu cuối đến trễ vài giây (mạng điện thoại chậm) mà không mất chữ.
export const SPEAKING_PLAN_GRACE_SECONDS = 10;
export const SPEAKING_PLAN_MAX_LENGTH = 5000;

export type SpeakingPrepUnit = "minutes" | "seconds";

// Kiểu chuẩn bị (Assignment.speakingPrepScope):
// - "per_question": mỗi câu Nói một ô dàn ý + đồng hồ riêng (mặc định, cả null).
// - "shared": một ô dàn ý + một đồng hồ chung cho cả phần Nói; hết giờ mới mở ghi
//   âm cho tất cả các câu. Dàn ý chung lưu ở SpeakingPlan của câu Nói ĐẦU TIÊN.
export type SpeakingPrepScope = "per_question" | "shared";

export function parseSpeakingPrepScope(value: FormDataEntryValue | null): SpeakingPrepScope {
  return value === "shared" ? "shared" : "per_question";
}

export function isSharedSpeakingPrep(scope: string | null | undefined): boolean {
  return scope === "shared";
}

// Đọc ô "Cho lập dàn ý" + [số] [phút|giây] trong form giao bài, quy ra giây.
// Không tick = null (tắt). Số trống/không hợp lệ thì lấy mặc định (1 phút); kết quả
// kẹp trong [15 giây, 10 phút]. Đơn vị không rõ thì hiểu là phút như form cũ.
export function parseSpeakingPrepSeconds(
  enabled: FormDataEntryValue | null,
  amount: FormDataEntryValue | null,
  unit: FormDataEntryValue | null
): number | null {
  if (enabled !== "on" && enabled !== "true") {
    return null;
  }
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    return SPEAKING_PREP_DEFAULT_SECONDS;
  }
  const seconds = Math.round(unit === "seconds" ? value : value * 60);
  return Math.min(SPEAKING_PREP_MAX_SECONDS, Math.max(SPEAKING_PREP_MIN_SECONDS, seconds));
}

// Ngược lại: hiện số giây đã lưu trong form sửa bài giao. Tròn phút thì hiện theo
// phút (giống form cũ), lẻ thì hiện theo giây.
export function splitSpeakingPrep(seconds: number): { amount: number; unit: SpeakingPrepUnit } {
  return seconds % 60 === 0
    ? { amount: seconds / 60, unit: "minutes" }
    : { amount: seconds, unit: "seconds" };
}

// Số giây chuẩn bị của một bài giao (null = tắt). Ưu tiên cột giây; bài giao tạo
// trước khi có cột này thì quy từ số phút cũ.
export function assignmentPrepSeconds(assignment: {
  speakingPrepSeconds: number | null;
  speakingPrepMinutes: number | null;
}): number | null {
  if (assignment.speakingPrepSeconds && assignment.speakingPrepSeconds > 0) {
    return assignment.speakingPrepSeconds;
  }
  if (assignment.speakingPrepMinutes && assignment.speakingPrepMinutes > 0) {
    return assignment.speakingPrepMinutes * 60;
  }
  return null;
}

// "30 giây", "1 phút", "1 phút 30 giây" — hiện cho học viên và trong form giao bài.
export function formatPrepDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  if (m === 0) {
    return `${s} giây`;
  }
  return s === 0 ? `${m} phút` : `${m} phút ${s} giây`;
}

function toMs(value: Date | string | number) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

// Hạn chót chuẩn bị = lúc bấm "Bắt đầu chuẩn bị" + N giây.
export function speakingPlanDeadline(startedAt: Date | string, prepSeconds: number): Date {
  return new Date(toMs(startedAt) + prepSeconds * 1000);
}

// Số giây chuẩn bị còn lại (không âm). Đã khoá thì coi như hết.
export function speakingPlanRemainingSeconds(
  plan: { startedAt: Date | string; lockedAt: Date | string | null },
  prepSeconds: number,
  now: Date | number = Date.now()
): number {
  if (plan.lockedAt) {
    return 0;
  }
  const left = speakingPlanDeadline(plan.startedAt, prepSeconds).getTime() - toMs(now);
  return Math.max(0, Math.ceil(left / 1000));
}

// Server còn nhận chữ dàn ý không: chưa khoá và chưa quá hạn chót + thời gian ân hạn.
export function canEditSpeakingPlan(
  plan: { startedAt: Date | string; lockedAt: Date | string | null },
  prepSeconds: number,
  now: Date | number = Date.now()
): boolean {
  if (plan.lockedAt) {
    return false;
  }
  const limit =
    speakingPlanDeadline(plan.startedAt, prepSeconds).getTime() +
    SPEAKING_PLAN_GRACE_SECONDS * 1000;
  return toMs(now) <= limit;
}

// Số giây học viên đã dùng để chuẩn bị (hiện ở trang chấm): tính tới lúc khoá, hoặc
// tới hạn chót nếu học viên bỏ ngang không bấm khoá. Không vượt quá N giây.
export function speakingPlanUsedSeconds(
  plan: { startedAt: Date | string; lockedAt: Date | string | null },
  prepSeconds: number,
  now: Date | number = Date.now()
): number {
  const budget = prepSeconds;
  const end = plan.lockedAt ? toMs(plan.lockedAt) : toMs(now);
  const used = Math.round((end - toMs(plan.startedAt)) / 1000);
  return Math.min(budget, Math.max(0, used));
}

export function formatPlanClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
