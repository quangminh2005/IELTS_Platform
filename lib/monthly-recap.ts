import { vietnamDateKey } from "@/lib/vocab-day";
import { unitXp, vocabDayXp } from "@/lib/monthly-xp";

// Tổng kết tháng (ý tưởng từ popup "Tổng kết tháng" của chin.edu.vn). Logic
// thuần — phần đọc DB ở lib/monthly-recap-data.ts. Khoá tháng "YYYY-MM" theo
// giờ VN. Kết quả MonthlyRecap chỉ gồm chuỗi/số vì đi qua unstable_cache (JSON).

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
export const RECAP_POPUP_DAYS = 7;

const MONTH_NAMES = [
  "Một", "Hai", "Ba", "Tư", "Năm", "Sáu",
  "Bảy", "Tám", "Chín", "Mười", "Mười Một", "Mười Hai"
];

const MONTH_KEY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

function splitKey(key: string): { year: number; month: number } {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

function joinKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function isMonthKey(value: unknown): value is string {
  return typeof value === "string" && MONTH_KEY_PATTERN.test(value);
}

export function monthKeyOf(date: Date): string {
  return vietnamDateKey(date).slice(0, 7);
}

export function shiftMonthKey(key: string, delta: number): string {
  const { year, month } = splitKey(key);
  const index = year * 12 + (month - 1) + delta;
  return joinKey(Math.floor(index / 12), (index % 12) + 1);
}

// [start, end) là hai thời điểm UTC ứng với nửa đêm giờ VN đầu tháng và đầu tháng sau.
export function monthRange(key: string): { start: Date; end: Date } {
  const { year, month } = splitKey(key);
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - VN_OFFSET_MS),
    end: new Date(Date.UTC(year, month, 1) - VN_OFFSET_MS)
  };
}

export function daysInMonth(key: string): number {
  const { year, month } = splitKey(key);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthName(key: string): string {
  return MONTH_NAMES[splitKey(key).month - 1];
}

export function monthNumberLabel(key: string): string {
  const { year, month } = splitKey(key);
  return `${String(month).padStart(2, "0")}/${year}`;
}

// Danh sách tháng cho ô chọn: tháng mới nhất trước.
export function recentMonthKeys(latest: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => shiftMonthKey(latest, -index));
}

// Tháng lạ / sai định dạng / ngoài danh sách → rơi về tháng mới nhất.
export function resolveMonthKey(param: unknown, latest: string, count: number): string {
  return isMonthKey(param) && recentMonthKeys(latest, count).includes(param) ? param : latest;
}

// Tháng cần tự bật popup lúc này (tháng trước), hoặc null nếu đã qua 7 ngày đầu tháng.
export function recapMonthToShow(now: Date): string | null {
  const day = Number(vietnamDateKey(now).slice(8, 10));
  return day <= RECAP_POPUP_DAYS ? shiftMonthKey(monthKeyOf(now), -1) : null;
}

// Một phần (AssignableUnit) trong một lượt làm, kỹ năng của phần đã nộp.
export type RecapUnitRow = {
  studentId: string;
  skill: string;
  submittedAt: Date;
  attemptRound: number;
  gradedCount: number;
  correctCount: number;
  manualAnswered: boolean;
  audioHidden?: boolean; // phần Nghe làm ở chế độ ẩn thanh audio
};

// Một lần nộp kỹ năng (hoặc cả bài với Attempt cũ) — chỉ để đếm ngày học.
export type RecapSubmitRow = { studentId: string; submittedAt: Date };

export type RecapVocabRow = { studentId: string; date: string; total: number };

export type RecapStudentInfo = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  avatarPreset: string | null;
  userImage: string | null;
  equippedFrame?: string | null;
};

export type RecapEntry = {
  studentId: string;
  displayName: string;
  avatarUrl: string | null;
  avatarPreset: string | null;
  userImage: string | null;
  equippedFrame?: string | null;
  xp: number;
  activeDays: number;
  activeDayKeys: string[]; // "YYYY-MM-DD", tăng dần
  unitsBySkill: Record<string, number>;
  vocabCards: number;
  xpRank: number | null; // null = 0 XP, không vào bảng XP
  daysRank: number | null;
};

export type MonthlyRecap = {
  monthKey: string;
  daysInMonth: number;
  totalXp: number;
  participantCount: number; // số học viên có XP > 0
  entries: RecapEntry[];
  xpBoard: RecapEntry[];
  daysBoard: RecapEntry[];
};

export type StudentRecapView = {
  entry: RecapEntry | null;
  previousXp: number | null; // null = tháng trước không có XP
  changePercent: number | null;
  topPercent: number | null; // "Top P% toàn trường"
};

function compareNames(a: RecapEntry, b: RecapEntry): number {
  return a.displayName.localeCompare(b.displayName, "vi");
}

// Xếp hạng kiểu thi đấu: đồng giá trị → đồng hạng, hạng sau nhảy cóc (1, 2, 2, 4).
function assignRanks(
  list: RecapEntry[],
  value: (entry: RecapEntry) => number,
  set: (entry: RecapEntry, rank: number) => void
) {
  let previousValue: number | null = null;
  let previousRank = 0;

  list.forEach((entry, index) => {
    const current = value(entry);
    const rank = index > 0 && current === previousValue ? previousRank : index + 1;
    set(entry, rank);
    previousValue = current;
    previousRank = rank;
  });
}

export function buildMonthlyRecap(input: {
  monthKey: string;
  units: RecapUnitRow[];
  submits: RecapSubmitRow[];
  vocab: RecapVocabRow[];
  students: RecapStudentInfo[];
}): MonthlyRecap {
  const prefix = `${input.monthKey}-`;
  const totals = new Map<
    string,
    { xp: number; days: Set<string>; unitsBySkill: Record<string, number>; vocabCards: number }
  >();

  function totalsOf(studentId: string) {
    let row = totals.get(studentId);
    if (!row) {
      row = { xp: 0, days: new Set(), unitsBySkill: {}, vocabCards: 0 };
      totals.set(studentId, row);
    }
    return row;
  }

  for (const unit of input.units) {
    const key = vietnamDateKey(unit.submittedAt);
    if (!key.startsWith(prefix)) {
      continue;
    }
    const row = totalsOf(unit.studentId);
    row.xp += unitXp(unit);
    row.unitsBySkill[unit.skill] = (row.unitsBySkill[unit.skill] ?? 0) + 1;
    row.days.add(key);
  }

  for (const submit of input.submits) {
    const key = vietnamDateKey(submit.submittedAt);
    if (key.startsWith(prefix)) {
      totalsOf(submit.studentId).days.add(key);
    }
  }

  for (const vocab of input.vocab) {
    if (!vocab.date.startsWith(prefix) || vocab.total < 1) {
      continue;
    }
    const row = totalsOf(vocab.studentId);
    row.xp += vocabDayXp(vocab.total);
    row.vocabCards += vocab.total;
    row.days.add(vocab.date);
  }

  const infoById = new Map(input.students.map((student) => [student.id, student]));
  const entries: RecapEntry[] = [];

  totals.forEach((row, studentId) => {
    const info = infoById.get(studentId);
    // Học viên đã bị xoá hồ sơ → bỏ qua.
    if (!info) {
      return;
    }
    const activeDayKeys = Array.from(row.days).sort();
    entries.push({
      studentId,
      displayName: info.displayName,
      avatarUrl: info.avatarUrl,
      avatarPreset: info.avatarPreset,
      userImage: info.userImage,
      equippedFrame: info.equippedFrame ?? null,
      xp: row.xp,
      activeDays: activeDayKeys.length,
      activeDayKeys,
      unitsBySkill: row.unitsBySkill,
      vocabCards: row.vocabCards,
      xpRank: null,
      daysRank: null
    });
  });

  const xpBoard = entries
    .filter((entry) => entry.xp > 0)
    .sort((a, b) => b.xp - a.xp || compareNames(a, b));
  assignRanks(xpBoard, (entry) => entry.xp, (entry, rank) => {
    entry.xpRank = rank;
  });

  const daysBoard = entries
    .filter((entry) => entry.activeDays > 0)
    .sort((a, b) => b.activeDays - a.activeDays || b.xp - a.xp || compareNames(a, b));
  assignRanks(daysBoard, (entry) => entry.activeDays, (entry, rank) => {
    entry.daysRank = rank;
  });

  entries.sort((a, b) => b.xp - a.xp || compareNames(a, b));

  return {
    monthKey: input.monthKey,
    daysInMonth: daysInMonth(input.monthKey),
    totalXp: entries.reduce((sum, entry) => sum + entry.xp, 0),
    participantCount: xpBoard.length,
    entries,
    xpBoard,
    daysBoard
  };
}

export function studentRecapView(
  recap: MonthlyRecap,
  studentId: string,
  previous: MonthlyRecap | null
): StudentRecapView {
  const entry = recap.entries.find((row) => row.studentId === studentId) ?? null;
  const previousEntry = previous?.entries.find((row) => row.studentId === studentId) ?? null;
  const previousXp = previousEntry && previousEntry.xp > 0 ? previousEntry.xp : null;
  const xp = entry?.xp ?? 0;

  return {
    entry,
    previousXp,
    changePercent:
      entry && previousXp !== null ? Math.round(((xp - previousXp) / previousXp) * 100) : null,
    topPercent:
      entry?.xpRank && recap.participantCount > 0
        ? Math.max(1, Math.ceil((entry.xpRank / recap.participantCount) * 100))
        : null
  };
}

// Biểu đồ cột XP cả trường (đã xếp giảm dần). Đông người thì gộp nhóm liền nhau
// thành tối đa maxBars cột (lấy trung bình) để cột không mỏng như sợi chỉ.
export function buildXpBars(
  values: number[],
  highlightIndex: number | null,
  maxBars = 40
): { heights: number[]; highlight: number | null } {
  if (values.length === 0) {
    return { heights: [], highlight: null };
  }

  const max = values[0] > 0 ? values[0] : 1;
  const barCount = Math.min(maxBars, values.length);
  const heights = Array.from({ length: barCount }, (_, bar) => {
    const from = Math.floor((bar * values.length) / barCount);
    const to = Math.floor(((bar + 1) * values.length) / barCount);
    const group = values.slice(from, to);
    const average = group.reduce((sum, value) => sum + value, 0) / group.length;
    return Math.round((average / max) * 1000) / 1000;
  });

  return {
    heights,
    highlight:
      highlightIndex === null
        ? null
        : Math.min(barCount - 1, Math.floor((highlightIndex * barCount) / values.length))
  };
}
