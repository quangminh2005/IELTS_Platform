// Lập dàn ý trước khi nói (Speaking): học viên có N phút chuẩn bị, viết dàn ý vào
// một ô; hết giờ thì ô khoá lại. Các hàm ở đây là hàm thuần — dùng chung cho server
// action (quyết định còn nhận chữ không), trang làm bài và trang chấm của giáo viên.

export const SPEAKING_PREP_MIN_MINUTES = 1;
export const SPEAKING_PREP_MAX_MINUTES = 10;
export const SPEAKING_PREP_DEFAULT_MINUTES = 1;
// Cho lần lưu cuối đến trễ vài giây (mạng điện thoại chậm) mà không mất chữ.
export const SPEAKING_PLAN_GRACE_SECONDS = 10;
export const SPEAKING_PLAN_MAX_LENGTH = 5000;

// Đọc ô "Cho lập dàn ý" + số phút trong form giao bài. Không tick = null (tắt).
// Số phút trống/không hợp lệ thì lấy mặc định; kẹp trong [1, 10].
export function parseSpeakingPrepMinutes(
  enabled: FormDataEntryValue | null,
  minutes: FormDataEntryValue | null
): number | null {
  if (enabled !== "on" && enabled !== "true") {
    return null;
  }
  const value = Math.floor(Number(minutes));
  if (!Number.isFinite(value) || value <= 0) {
    return SPEAKING_PREP_DEFAULT_MINUTES;
  }
  return Math.min(SPEAKING_PREP_MAX_MINUTES, Math.max(SPEAKING_PREP_MIN_MINUTES, value));
}

function toMs(value: Date | string | number) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

// Hạn chót chuẩn bị = lúc bấm "Bắt đầu chuẩn bị" + N phút.
export function speakingPlanDeadline(startedAt: Date | string, prepMinutes: number): Date {
  return new Date(toMs(startedAt) + prepMinutes * 60_000);
}

// Số giây chuẩn bị còn lại (không âm). Đã khoá thì coi như hết.
export function speakingPlanRemainingSeconds(
  plan: { startedAt: Date | string; lockedAt: Date | string | null },
  prepMinutes: number,
  now: Date | number = Date.now()
): number {
  if (plan.lockedAt) {
    return 0;
  }
  const left = speakingPlanDeadline(plan.startedAt, prepMinutes).getTime() - toMs(now);
  return Math.max(0, Math.ceil(left / 1000));
}

// Server còn nhận chữ dàn ý không: chưa khoá và chưa quá hạn chót + thời gian ân hạn.
export function canEditSpeakingPlan(
  plan: { startedAt: Date | string; lockedAt: Date | string | null },
  prepMinutes: number,
  now: Date | number = Date.now()
): boolean {
  if (plan.lockedAt) {
    return false;
  }
  const limit =
    speakingPlanDeadline(plan.startedAt, prepMinutes).getTime() +
    SPEAKING_PLAN_GRACE_SECONDS * 1000;
  return toMs(now) <= limit;
}

// Số giây học viên đã dùng để chuẩn bị (hiện ở trang chấm): tính tới lúc khoá, hoặc
// tới hạn chót nếu học viên bỏ ngang không bấm khoá. Không vượt quá N phút.
export function speakingPlanUsedSeconds(
  plan: { startedAt: Date | string; lockedAt: Date | string | null },
  prepMinutes: number,
  now: Date | number = Date.now()
): number {
  const budget = prepMinutes * 60;
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
