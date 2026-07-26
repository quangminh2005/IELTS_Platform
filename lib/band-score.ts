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

// Số câu đúng/tổng của một kỹ năng trong một lần làm bài, đã gộp sẵn (ví dụ do
// database gộp giúp) — dùng thay cho việc tải về từng câu trả lời.
export type SkillCount = { skill: string; correct: number; total: number };

// Nhãn ngắn tiếng Việt cho kỹ năng. Viết/Nói không bao giờ ra từ bandsBySkill
// (chấm tay, không có band) nhưng vẫn cần nhãn ở chỗ liệt kê kỹ năng của bài.
export const SKILL_SHORT_LABELS: Record<string, string> = {
  listening: "Nghe",
  reading: "Đọc",
  writing: "Viết",
  speaking: "Nói"
};

// Làm tròn về nửa band gần nhất (thang IELTS: 0.5), giống cách tính band tổng.
export function roundHalfBand(value: number): number {
  return Math.round(value * 2) / 2;
}

// Trung bình các band (làm tròn nửa band). Danh sách rỗng -> null.
export function averageBand(bands: number[]): number | null {
  if (bands.length === 0) {
    return null;
  }

  return roundHalfBand(bands.reduce((total, band) => total + band, 0) / bands.length);
}

// Band đại diện cho MỘT lần làm bài, dùng cho trang Lịch sử & Xếp hạng.
// Ưu tiên band do giáo viên chấm (Nói/Viết), sau đó tới band tự động của bài
// Nghe/Đọc đủ 40 câu. Không đủ điều kiện quy đổi -> null (phía hiển thị giữ %).
export function attemptBand(
  overallBand: number | null,
  answers: Array<{ isCorrect: boolean | null; skill: string }>
): number | null {
  return attemptBandFromCounts(
    overallBand,
    bandsBySkill(answers).map(({ skill, correct, total }) => ({ skill, correct, total }))
  );
}

// Như attemptBand nhưng nhận số câu đúng đã gộp sẵn theo kỹ năng.
export function attemptBandFromCounts(
  overallBand: number | null,
  counts: SkillCount[]
): number | null {
  if (overallBand !== null) {
    return overallBand;
  }

  const skillBands = counts
    .filter((row) => isBandSkill(row.skill))
    .map((row) => bandScore(row.skill, row.correct, row.total))
    .filter((band): band is number => band !== null);

  return averageBand(skillBands);
}
