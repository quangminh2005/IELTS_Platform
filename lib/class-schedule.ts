// Lịch học của lớp: lịch cố định hàng tuần -> từng buổi học cụ thể (ClassSession).
// Module thuần: không đụng Prisma, không đụng React — test được và dùng được ở cả
// server lẫn client component. Giờ VN cố định UTC+7 (không có giờ mùa hè).

import { vnDateKey } from "@/lib/attendance";
import { VN_OFFSET_MS } from "@/lib/streak";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

// Lớp học liên tục (không đặt số buổi / ngày kết thúc): luôn có sẵn buổi cho 12 tuần tới.
export const CONTINUOUS_HORIZON_DAYS = 84;
// Giới hạn an toàn cho một lần tạo buổi, phòng lịch sai sinh vô hạn dòng.
export const MAX_PLAN_DAYS = 730;
const MAX_SLOTS = 14;

// Chỉ số theo thứ ISO: 1 = Thứ 2 … 7 = Chủ nhật. Ô 0 bỏ trống cho dễ tra.
export const WEEKDAY_SHORT = ["", "T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;
export const WEEKDAY_LONG = ["", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"] as const;

export type ScheduleSlot = { weekday: number; startMinute: number; endMinute: number };

export type SessionForPlan = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  kind: string;
  edited: boolean;
  originalStartsAt: Date | null;
};

export type PlannedSession = { startsAt: Date; endsAt: Date };

// ---- Giờ giấc ----

// "20:15" -> 1215 (phút từ 00:00). Sai định dạng -> null.
export function parseHm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

// 540 -> "09:00". Luôn 2 chữ số để dùng thẳng làm value của <input type="time">.
export function formatHm(minute: number): string {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

// Mốc 00:00 giờ VN của ngày "YYYY-MM-DD".
export function vnMidnight(ymd: string): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - VN_OFFSET_MS);
}

export function vnDateTime(ymd: string, minute: number): Date {
  return new Date(vnMidnight(ymd).getTime() + minute * MINUTE_MS);
}

// Thứ ISO (1 = Thứ 2 … 7 = CN) của một mốc, tính theo giờ VN.
export function vnIsoWeekday(date: Date): number {
  const day = new Date(date.getTime() + VN_OFFSET_MS).getUTCDay(); // 0 = CN
  return day === 0 ? 7 : day;
}

// Số phút tính từ 00:00 giờ VN.
export function vnMinuteOfDay(date: Date): number {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

export function formatVnTime(date: Date): string {
  return formatHm(vnMinuteOfDay(date));
}

// "T6 26/9"
export function formatShortDate(date: Date): string {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  return `${WEEKDAY_SHORT[vnIsoWeekday(date)]} ${shifted.getUTCDate()}/${shifted.getUTCMonth() + 1}`;
}

// ---- Lịch cố định ----

// Đọc danh sách khung giờ từ form (JSON đã parse). Không dùng zod để module này
// còn nhẹ khi client component import. Lỗi ném ra là câu tiếng Việt cho toast.
export function parseScheduleSlots(raw: unknown): ScheduleSlot[] {
  if (!Array.isArray(raw)) {
    throw new Error("Lịch cố định không hợp lệ.");
  }
  if (raw.length > MAX_SLOTS) {
    throw new Error(`Tối đa ${MAX_SLOTS} khung giờ mỗi tuần.`);
  }

  const slots: ScheduleSlot[] = [];
  const seen = new Set<string>();

  for (const item of raw as Array<Record<string, unknown> | null>) {
    const weekday = Number(item?.weekday);
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
      throw new Error("Thứ trong tuần không hợp lệ.");
    }
    const startMinute = typeof item?.start === "string" ? parseHm(item.start) : null;
    const endMinute = typeof item?.end === "string" ? parseHm(item.end) : null;
    if (startMinute === null || endMinute === null) {
      throw new Error(`${WEEKDAY_LONG[weekday]}: giờ học không hợp lệ.`);
    }
    if (endMinute <= startMinute) {
      throw new Error(`${WEEKDAY_LONG[weekday]}: giờ kết thúc phải sau giờ bắt đầu.`);
    }
    const key = `${weekday}-${startMinute}`;
    if (seen.has(key)) {
      throw new Error(`${WEEKDAY_LONG[weekday]} bị trùng khung giờ ${formatHm(startMinute)}.`);
    }
    seen.add(key);
    slots.push({ weekday, startMinute, endMinute });
  }

  return slots.sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);
}

// Chuỗi đại diện cho lịch cố định — so trước/sau khi lưu để chỉ báo chuông
// "lịch vừa cập nhật" khi có thay đổi thật, không phải mỗi lần bấm Lưu.
export function scheduleSignature(input: {
  slots: ScheduleSlot[];
  startDate: Date | null;
  totalSessions: number | null;
  endDate: Date | null;
  location: string | null;
}): string {
  const slots = input.slots
    .map((slot) => `${slot.weekday}@${slot.startMinute}-${slot.endMinute}`)
    .sort()
    .join(",");
  return JSON.stringify([
    slots,
    input.startDate?.getTime() ?? null,
    input.totalSessions,
    input.endDate?.getTime() ?? null,
    input.location ?? null
  ]);
}

// ---- Đồng bộ lịch cố định -> từng buổi ----

// Buổi được tính vào "Buổi X/Y": có học, và là buổi thường hoặc học bù.
export function isCountedSession(session: { status: string; kind: string }): boolean {
  return session.status === "scheduled" && (session.kind === "regular" || session.kind === "makeup");
}

// Xem spec docs/superpowers/specs/2026-09-24-lich-hoc-hoc-vien-design.md mục 3. Tóm tắt:
// - Buổi đóng băng (trước applyFrom, đã sửa tay, học bù/tăng cường) không bị đụng tới
//   và chiếm khung giờ gốc của nó.
// - Sinh buổi mong muốn từ max(applyFrom, ngày khai giảng) theo lịch cố định, dừng khi
//   đủ số buổi / qua ngày kết thúc / hết 12 tuần (lớp học liên tục) / quá 2 năm.
// - Buổi thay được trùng giờ với buổi mong muốn thì giữ (giữ id), còn lại xoá; buổi
//   mong muốn còn thiếu thì tạo.
export function planRegularSessions(input: {
  slots: ScheduleSlot[];
  scheduleStartDate: Date | null;
  scheduleEndDate: Date | null;
  totalSessions: number | null;
  existing: SessionForPlan[];
  applyFrom: Date;
  now: Date;
}): { create: PlannedSession[]; deleteIds: string[] } {
  const applyFromMs = input.applyFrom.getTime();
  const isReplaceable = (session: SessionForPlan) =>
    session.kind === "regular" && !session.edited && session.startsAt.getTime() >= applyFromMs;
  const frozen = input.existing.filter((session) => !isReplaceable(session));
  const replaceable = input.existing.filter(isReplaceable);

  const desired: PlannedSession[] = [];

  if (input.slots.length > 0) {
    const startMs = Math.max(applyFromMs, input.scheduleStartDate?.getTime() ?? applyFromMs);
    let limitMs = startMs + MAX_PLAN_DAYS * DAY_MS;
    if (input.scheduleEndDate) {
      limitMs = Math.min(limitMs, input.scheduleEndDate.getTime() + DAY_MS);
    } else if (input.totalSessions === null) {
      limitMs = Math.min(limitMs, input.now.getTime() + CONTINUOUS_HORIZON_DAYS * DAY_MS);
    }

    const occupied = new Set(
      frozen.map((session) => (session.originalStartsAt ?? session.startsAt).getTime())
    );
    let quota =
      input.totalSessions === null
        ? Number.POSITIVE_INFINITY
        : input.totalSessions - frozen.filter(isCountedSession).length;

    const slots = [...input.slots].sort((a, b) => a.startMinute - b.startMinute);
    let dayMs = vnMidnight(vnDateKey(new Date(startMs))).getTime();

    while (quota > 0 && dayMs < limitMs) {
      const weekday = vnIsoWeekday(new Date(dayMs));
      for (const slot of slots) {
        if (quota <= 0) {
          break;
        }
        if (slot.weekday !== weekday) {
          continue;
        }
        const startsAtMs = dayMs + slot.startMinute * MINUTE_MS;
        if (startsAtMs < startMs || startsAtMs >= limitMs || occupied.has(startsAtMs)) {
          continue;
        }
        desired.push({
          startsAt: new Date(startsAtMs),
          endsAt: new Date(dayMs + slot.endMinute * MINUTE_MS)
        });
        quota -= 1;
      }
      dayMs += DAY_MS;
    }
  }

  const keyOf = (startsAt: Date, endsAt: Date) => `${startsAt.getTime()}-${endsAt.getTime()}`;
  const desiredKeys = new Set(desired.map((session) => keyOf(session.startsAt, session.endsAt)));
  const keptKeys = new Set<string>();
  const deleteIds: string[] = [];

  for (const session of replaceable) {
    const key = keyOf(session.startsAt, session.endsAt);
    if (desiredKeys.has(key) && !keptKeys.has(key)) {
      keptKeys.add(key);
    } else {
      deleteIds.push(session.id);
    }
  }

  const create = desired.filter((session) => !keptKeys.has(keyOf(session.startsAt, session.endsAt)));

  return { create, deleteIds };
}

// Số thứ tự buổi (1, 2, 3…) trong MỘT lớp: chỉ buổi được đếm, theo giờ bắt đầu.
export function numberSessions(
  sessions: Array<{ id: string; startsAt: Date; status: string; kind: string }>
): Map<string, number> {
  const counted = sessions
    .filter(isCountedSession)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return new Map(counted.map((session, index) => [session.id, index + 1]));
}

export function sessionNumberText(number: number | null, total: number | null): string | null {
  if (number === null) {
    return null;
  }
  return total ? `Buổi ${number}/${total}` : `Buổi ${number}`;
}
