import { unitXp, vocabDayXp } from "@/lib/monthly-xp";

// Quy tắc kiếm Xu (Cửa hàng trang trí). Xu ăn theo XP của Tổng kết tháng — muốn
// đổi tỉ lệ thì sửa COINS_PER_XP; dòng sổ đã ghi không bị ảnh hưởng.
export const COINS_PER_XP = 1;

export type CoinKind = "earn_unit" | "earn_vocab" | "purchase" | "streak_restore";

// Một phần (AssignableUnit) trong một lượt làm LƯỢT ĐẦU (attemptRound = 1).
export type CoinUnitRow = {
  attemptId: string;
  assignmentId: string;
  isPractice: boolean;
  unitId: string;
  submittedAt: Date | null; // null = kỹ năng chứa phần này chưa nộp
  gradedCount: number;
  correctCount: number;
  manualAnswered: boolean;
  note: string; // "Tên đề – Tên phần"
};

export type CoinEntryDraft = {
  kind: CoinKind;
  key: string;
  amount: number;
  note: string;
  attemptId: string | null;
  createdAt: Date;
};

export function unitCoins(row: Pick<CoinUnitRow, "gradedCount" | "correctCount" | "manualAnswered">): number {
  return Math.floor(unitXp({ ...row, attemptRound: 1 }) * COINS_PER_XP);
}

// Bài giao: mỗi (bài giao, phần) một lần — thầy reset lượt cũng không cộng lại.
// Tự luyện: mỗi phần một lần cho mọi phạm vi luyện (cả đề hay lẻ phần).
export function unitCoinKey(row: Pick<CoinUnitRow, "isPractice" | "assignmentId" | "unitId">): string {
  return row.isPractice ? `practice:${row.unitId}` : `unit:${row.assignmentId}:${row.unitId}`;
}

export function vocabKey(dateKey: string): string {
  return `vocab:${dateKey}`;
}

export function purchaseKey(itemKey: string): string {
  return `buy:${itemKey}`;
}

// Các phần đã từng ra Xu (bài giao hoặc tự luyện).
export function earnedUnitIds(keys: Iterable<string>): Set<string> {
  const ids = new Set<string>();

  for (const key of Array.from(keys)) {
    if (key.startsWith("unit:")) {
      ids.add(key.slice(key.lastIndexOf(":") + 1));
    } else if (key.startsWith("practice:")) {
      ids.add(key.slice("practice:".length));
    }
  }

  return ids;
}

export function planUnitEntries(rows: CoinUnitRow[], existingKeys: Set<string>): CoinEntryDraft[] {
  const taken = new Set(existingKeys);
  const earned = earnedUnitIds(existingKeys);
  const plan: CoinEntryDraft[] = [];

  // Theo thứ tự nộp: phần làm ở bài giao trước rồi mới tự luyện thì tự luyện bị bỏ.
  const submitted = rows
    .filter((row): row is CoinUnitRow & { submittedAt: Date } => row.submittedAt !== null)
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());

  for (const row of submitted) {
    const amount = unitCoins(row);
    const key = unitCoinKey(row);

    if (amount <= 0 || taken.has(key)) continue;
    if (row.isPractice && earned.has(row.unitId)) continue;

    plan.push({
      kind: "earn_unit",
      key,
      amount,
      note: row.note,
      attemptId: row.attemptId,
      createdAt: row.submittedAt
    });
    taken.add(key);
    earned.add(row.unitId);
  }

  return plan;
}

export function vocabCoins(total: number): number {
  return Math.floor(vocabDayXp(total) * COINS_PER_XP);
}

// Dòng sổ của một ngày ôn được nâng dần trong ngày, không bao giờ hạ.
export function planVocabEntries(
  days: { date: string; total: number }[],
  existing: Map<string, number>
): { create: CoinEntryDraft[]; raise: { key: string; amount: number }[] } {
  const create: CoinEntryDraft[] = [];
  const raise: { key: string; amount: number }[] = [];

  for (const day of days) {
    const amount = vocabCoins(day.total);
    if (amount <= 0) continue;

    const key = vocabKey(day.date);
    const current = existing.get(key);

    if (current === undefined) {
      create.push({
        kind: "earn_vocab",
        key,
        amount,
        note: `Ôn ${day.total} thẻ Sổ từ`,
        attemptId: null,
        // Giữa trưa giờ VN của ngày đó — lịch sử Xu xếp đúng ngày.
        createdAt: new Date(`${day.date}T12:00:00+07:00`)
      });
    } else if (amount > current) {
      raise.push({ key, amount });
    }
  }

  return { create, raise };
}
