// Quy đổi số câu đúng (trên thang 40 câu) sang band điểm IELTS.
// Nguồn: bảng quy đổi chuẩn IELTS — Listening và Reading (Academic).
// Mỗi bảng là danh sách [số câu đúng tối thiểu, band], xếp giảm dần.

type BandRow = [minCorrect: number, band: number];

const LISTENING: BandRow[] = [
  [39, 9],
  [37, 8.5],
  [35, 8],
  [32, 7.5],
  [30, 7],
  [26, 6.5],
  [23, 6],
  [18, 5.5],
  [16, 5],
  [13, 4.5],
  [11, 4]
];

const READING_ACADEMIC: BandRow[] = [
  [39, 9],
  [37, 8.5],
  [35, 8],
  [33, 7.5],
  [30, 7],
  [27, 6.5],
  [23, 6],
  [19, 5.5],
  [15, 5],
  [13, 4.5],
  [10, 4],
  [8, 3.5],
  [6, 3],
  [4, 2.5]
];

function tableForSkill(skill: string): BandRow[] | null {
  if (skill === "listening") {
    return LISTENING;
  }

  if (skill === "reading") {
    return READING_ACADEMIC;
  }

  return null;
}

function lookupBand(table: BandRow[], correctOutOf40: number): number | null {
  for (const [minCorrect, band] of table) {
    if (correctOutOf40 >= minCorrect) {
      return band;
    }
  }

  return null;
}

/**
 * Quy đổi sang band cho một kỹ năng (listening / reading).
 * Band IELTS chỉ có ý nghĩa với bài THI ĐỦ 40 câu, nên chỉ quy đổi khi tổng số
 * câu đúng bằng 40 (không tự "phóng" số câu ít lên thang 40). Bài lẻ (vd 10 câu)
 * trả về null — phía hiển thị sẽ bỏ qua band, chỉ giữ % và số câu đúng.
 */
const FULL_TEST_QUESTIONS = 40;

export function bandScore(skill: string, correct: number, total: number): number | null {
  const table = tableForSkill(skill);

  if (!table || total !== FULL_TEST_QUESTIONS) {
    return null;
  }

  return lookupBand(table, Math.max(0, correct));
}

export function isBandSkill(skill: string): boolean {
  return skill === "listening" || skill === "reading";
}

export function formatBand(band: number | null): string {
  return band === null ? "—" : band.toFixed(1);
}

export type SkillBand = {
  skill: string;
  correct: number;
  total: number;
  band: number | null;
};

// Gộp các câu đã chấm tự động theo kỹ năng (Nghe/Đọc) rồi quy đổi band.
// Dùng chung cho trang kết quả của học sinh và khu vực giáo viên.
export function bandsBySkill(
  answers: Array<{ isCorrect: boolean | null; skill: string }>
): SkillBand[] {
  const bySkill = new Map<string, { correct: number; total: number }>();

  for (const answer of answers) {
    if (!isBandSkill(answer.skill) || answer.isCorrect === null) {
      continue;
    }

    const current = bySkill.get(answer.skill) ?? { correct: 0, total: 0 };
    current.total += 1;
    if (answer.isCorrect) {
      current.correct += 1;
    }
    bySkill.set(answer.skill, current);
  }

  return [...bySkill.entries()].map(([skill, { correct, total }]) => ({
    skill,
    correct,
    total,
    band: bandScore(skill, correct, total)
  }));
}

export const SKILL_SHORT_LABELS: Record<string, string> = {
  listening: "Nghe",
  reading: "Đọc"
};
