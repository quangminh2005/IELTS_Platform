import { parsePracticeScopeKey } from "@/lib/practice";
import {
  QUESTION_GROUPS,
  groupForQuestionType,
  type QuestionGroupKey
} from "@/lib/question-stats";

// Nhãn tiến độ tự luyện hiện trên mỗi thẻ đề. Tách khỏi UI để test được.
export function practiceProgressLabel(
  rounds: number,
  bestCorrect: number | null,
  totalQuestions: number
): string {
  if (rounds === 0) {
    return "Chưa luyện";
  }

  const lan = `Đã luyện ${rounds} lần`;

  // Không có điểm cả-đề để so — hoặc vì bài đang chờ giáo viên chấm tay, hoặc vì
  // học viên mới chỉ luyện lẻ từng phần (điểm phần lẻ không cùng thang với
  // totalQuestions của cả đề nên không thể quy ra "x/tổng"). Không đoán thêm.
  if (bestCorrect === null) {
    return lan;
  }

  return `${lan} · cao nhất ${bestCorrect}/${totalQuestions}`;
}

// Một lượt tự luyện đã nộp, rút gọn còn đúng 2 trường cần để gộp tiến độ.
export type PracticeAttemptSummary = {
  practiceScopeKey: string | null;
  score: number | null;
};

// Tiến độ tự luyện của một đề: tổng số lượt (mọi phạm vi) + điểm cao nhất
// (chỉ tính lượt luyện CẢ ĐỀ).
export type PracticeMaterialProgress = {
  rounds: number;
  bestCorrect: number | null;
};

// Gộp danh sách lượt tự luyện thành tiến độ theo từng đề (khoá bằng materialId).
//
// Khoá `practiceScopeKey` có dạng "studentId:materialId:unitId|all" (xem
// lib/practice.ts). Số LƯỢT đếm mọi phạm vi — luyện lẻ từng phần vẫn tính là một
// lượt. Nhưng điểm "cao nhất" CHỈ được gộp từ lượt có phân đoạn thứ ba đúng bằng
// "all" (luyện cả đề) — điểm của một lượt luyện lẻ một phần (ví dụ 10/10 của Part 1
// trong đề Listening 40 câu) không cùng thang với tổng số câu cả đề, gộp vào sẽ ra
// nhãn sai lệch kiểu "cao nhất 10/40" trong khi thực chất học viên làm đúng hết
// phần đã luyện.
export function summarizePracticeAttempts(
  attempts: PracticeAttemptSummary[]
): Map<string, PracticeMaterialProgress> {
  const summary = new Map<string, PracticeMaterialProgress>();

  for (const attempt of attempts) {
    const scope = parsePracticeScopeKey(attempt.practiceScopeKey);
    if (scope === null) continue;

    const materialId = scope.materialId;

    const progress = summary.get(materialId) ?? { rounds: 0, bestCorrect: null };
    progress.rounds += 1;

    if (scope.unitId === null && attempt.score !== null) {
      // score là Float (điểm có thể lẻ ở bài chấm tay) — làm tròn để nhãn đọc gọn.
      const roundedScore = Math.round(attempt.score);
      progress.bestCorrect =
        progress.bestCorrect === null
          ? roundedScore
          : Math.max(progress.bestCorrect, roundedScore);
    }

    summary.set(materialId, progress);
  }

  return summary;
}

// Một lượt tự luyện CHƯA nộp, rút gọn còn đúng 2 trường cần để biết "đang làm dở ở
// phạm vi nào, có đồng hồ không".
export type PracticeUnfinishedAttempt = {
  practiceScopeKey: string | null;
  skillTimeLimitsJson: string | null;
};

// Trạng thái "còn dở" của một phạm vi luyện. timed = lượt đang dở đó có đồng hồ đếm
// ngược hay không.
export type PracticeResumeState = { timed: boolean };

// Gộp các lượt chưa nộp thành bản đồ theo KHOÁ PHẠM VI (không phải materialId như
// summarizePracticeAttempts): thư viện cần phân biệt "còn dở cả đề" với "còn dở đúng
// một phần". Một phạm vi lẽ ra chỉ có tối đa một lượt dở, nhưng nếu dữ liệu cũ có
// nhiều thì chỉ cần MỘT lượt còn đồng hồ là coi như phạm vi đó đang tính giờ — thà
// hỏi thừa "bỏ đồng hồ?" còn hơn giấu mất lối gỡ đồng hồ duy nhất của học viên.
export function summarizeUnfinishedPractice(
  attempts: PracticeUnfinishedAttempt[]
): Map<string, PracticeResumeState> {
  const unfinished = new Map<string, PracticeResumeState>();

  for (const attempt of attempts) {
    const key = attempt.practiceScopeKey;
    if (!key) continue;

    const timed = attempt.skillTimeLimitsJson !== null;
    const current = unfinished.get(key);
    unfinished.set(key, { timed: timed || (current?.timed ?? false) });
  }

  return unfinished;
}

export type PracticeUnitItem = {
  id: string;
  title: string;
  questionCount: number;
  // Phần Nghe có audio — mới có nghĩa khi hỏi "ẩn thanh audio".
  hasAudio: boolean;
  // null = chưa có lượt nào đang dở ở phần này.
  resume: PracticeResumeState | null;
  // Các nhóm dạng câu có trong phần (thứ tự theo QUESTION_GROUPS) — để lọc theo dạng.
  questionGroups: QuestionGroupKey[];
  // Số thứ tự Part/Passage/Task đọc từ tên (null = unit không theo khuôn đề IELTS).
  partNumber: number | null;
  // Số lượt đã nộp có phủ phần này (luyện lẻ + luyện cả đề) và số câu đúng cao nhất.
  rounds: number;
  // null = phần chấm tay (Viết/Nói) — không in "x/y" trên thẻ.
  bestCorrect: number | null;
};

export type PracticeMaterialItem = {
  id: string;
  title: string;
  skill: string;
  sourceLabel: string | null;
  unitCount: number;
  questionCount: number;
  progressLabel: string;
  // Có ít nhất một phần Nghe có audio (luyện cả đề mới hỏi "ẩn thanh audio").
  hasAudio: boolean;
  // Thầy bật "ẩn thanh audio" cho đề (Material.practiceLockAudio) — luôn ẩn, học
  // viên không gỡ được nhưng vẫn được thưởng.
  lockAudioForced: boolean;
  // Lượt đang dở của phạm vi CẢ ĐỀ (phạm vi từng phần nằm ở units[].resume).
  resume: PracticeResumeState | null;
  units: PracticeUnitItem[];
  // Hợp các nhóm dạng câu của mọi phần.
  questionGroups: QuestionGroupKey[];
  // Kệ sách (Material.bookName, thiếu thì sourceLabel) — tab bộ sách kiểu chin.
  book: string;
  // Tiến độ cả đề cho thẻ full test.
  rounds: number;
  bestCorrect: number | null;
  band: number | null;
  // Ngày nộp gần nhất (ISO) của mọi lượt thuộc đề, null = chưa luyện.
  lastPracticedAt: string | null;
};

// ===== Lọc thư viện theo dạng câu =====

// Đổi danh sách questionType (có thể lặp, có thể là dạng chấm tay) thành các nhóm
// dạng câu, bỏ trùng, xếp theo thứ tự QUESTION_GROUPS. writing_task/speaking_task
// không có nhóm nên tự rơi ra.
export function questionGroupsOf(questionTypes: Iterable<string>): QuestionGroupKey[] {
  const found = new Set<QuestionGroupKey>();
  for (const type of questionTypes) {
    const group = groupForQuestionType(type);
    if (group) found.add(group);
  }
  return QUESTION_GROUPS.map((group) => group.key).filter((key) => found.has(key));
}

// Đọc ?type= trên URL (link "Luyện dạng này" ở trang Tiến bộ). Giá trị lạ -> null.
export function parseQuestionGroupParam(value: string | undefined | null): QuestionGroupKey | null {
  if (!value) return null;
  return QUESTION_GROUPS.some((group) => group.key === value) ? (value as QuestionGroupKey) : null;
}

// Đếm số đề có từng nhóm dạng câu — số hiện trên chip lọc. Chỉ trả các nhóm có ít
// nhất một đề, giữ thứ tự QUESTION_GROUPS.
export function countByQuestionGroup(
  items: Array<Pick<PracticeMaterialItem, "questionGroups">>
): Array<{ key: QuestionGroupKey; label: string; count: number }> {
  return QUESTION_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    count: items.filter((item) => item.questionGroups.includes(group.key)).length
  })).filter((row) => row.count > 0);
}

// ===== Bộ lọc kiểu chin.edu.vn: bộ sách / Part / full test =====

// Tên gọi một "phần" theo kỹ năng — giống đề thi thật: Nghe có Part, Đọc có
// Passage, Viết có Task, Nói có Part.
const PART_WORD: Record<string, string> = {
  listening: "Part",
  reading: "Passage",
  writing: "Task",
  speaking: "Part"
};

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

// Đọc số thứ tự phần từ tên unit: "Listening Section 1 – …", "Listening Part 2 – …",
// "Passage 3 – …", "Part One – …" (GT), "Writing Task 1 – …", "Speaking Part 3 – …".
// Unit không theo khuôn đề IELTS (vd "Unit 12  Acid Rain!" của LPTD) -> null, chỉ
// hiện ở "Tất cả part".
export function partNumberOf(unitTitle: string): number | null {
  const match = /\b(?:part|section|passage|task)\s+(\d+|one|two|three|four|five)\b/i.exec(unitTitle);
  if (!match) return null;
  const raw = match[1].toLowerCase();
  const value = WORD_NUMBERS[raw] ?? Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function partLabelOf(skill: string, partNumber: number): string {
  return `${PART_WORD[skill] ?? "Part"} ${partNumber}`;
}

// Nhãn ngắn trên thẻ + tên chủ đề của unit. "Listening Part 1 – Self-drive tours"
// -> { badge: "Part 1", topic: "Self-drive tours" }; "Unit 3  Growing Roses" ->
// { badge: "Unit 3", topic: "Growing Roses" }; tên lạ thì giữ nguyên làm chủ đề.
export function unitCardText(
  skill: string,
  unitTitle: string
): { badge: string | null; topic: string } {
  const title = unitTitle.trim();
  const partNumber = partNumberOf(title);
  const dash = title.search(/\s[–—-]\s/);

  if (partNumber !== null) {
    const topic = dash >= 0 ? title.slice(dash + 3).trim() : title;
    return { badge: partLabelOf(skill, partNumber), topic: topic || title };
  }

  const unit = /^(unit\s+\d+)\s*[:.–—-]?\s*(.*)$/i.exec(title);
  if (unit) {
    return { badge: unit[1].replace(/\s+/g, " "), topic: unit[2].trim() || title };
  }

  return { badge: null, topic: title };
}

// Bỏ đuôi "(Listening)" / "(Reading)"... trên tên đề — kỹ năng đã nằm ở tab.
export function shortMaterialTitle(title: string): string {
  return title.replace(/\s*\((listening|reading|writing|speaking)\)\s*$/i, "").trim();
}

// Chữ in trên bìa thẻ full test, kiểu chin: "CAMBRIDGE IELTS" / "10" / "TEST 1".
// "Cambridge IELTS 10 – Test 1 (Listening)" -> kicker "Cambridge IELTS", big "10",
// sub "Test 1"; "Listening Practice Through Dictation 3" -> big "3", sub "".
// Không có số nào -> big null (thẻ chỉ in tên).
export function materialCoverText(title: string): {
  kicker: string;
  big: string | null;
  sub: string;
} {
  const short = shortMaterialTitle(title);
  const withRest = /^(.*?)\s*(\d+)\s*[–—-]\s*(.+)$/.exec(short);
  if (withRest && withRest[1]) {
    return { kicker: withRest[1].trim(), big: withRest[2], sub: withRest[3].trim() };
  }
  const trailing = /^(.*?)\s+(\d+)$/.exec(short);
  if (trailing) {
    return { kicker: trailing[1].trim(), big: trailing[2], sub: "" };
  }
  return { kicker: short, big: null, sub: "" };
}

// Một lượt tự luyện đã nộp kèm số câu đúng của từng phần trong lượt đó.
export type PracticeAttemptDetail = {
  practiceScopeKey: string | null;
  correctByUnit: Record<string, number>;
};

export type PracticeUnitProgress = { rounds: number; bestCorrect: number };

// Tiến độ từng PHẦN (thẻ Part kiểu chin "Đã làm 7/10"): lượt luyện lẻ phần đó và
// lượt luyện cả đề đều tính — làm full test xong thì 4 thẻ Part cũng thành "Đã
// làm". bestCorrect = số câu đúng cao nhất của phần đó qua các lượt.
export function summarizeUnitProgress(
  attempts: PracticeAttemptDetail[],
  unitIdsByMaterial: Map<string, string[]>
): Map<string, PracticeUnitProgress> {
  const summary = new Map<string, PracticeUnitProgress>();

  for (const attempt of attempts) {
    const scope = parsePracticeScopeKey(attempt.practiceScopeKey);
    if (scope === null) continue;

    const covered = scope.unitId ? [scope.unitId] : unitIdsByMaterial.get(scope.materialId) ?? [];
    for (const unitId of covered) {
      const correct = attempt.correctByUnit[unitId] ?? 0;
      const current = summary.get(unitId);
      summary.set(unitId, {
        rounds: (current?.rounds ?? 0) + 1,
        bestCorrect: Math.max(current?.bestCorrect ?? 0, correct)
      });
    }
  }

  return summary;
}

// Sắp tab bộ sách: bộ đề IELTS (có Part/Passage) lên trước, trong đó số lớn trước
// (Cambridge 20 trước Cambridge 10, như chin để sách mới nhất lên đầu); sách bổ trợ
// (LPTD...) xuống sau.
const bookCollator = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });

export function sortBooks(books: Array<{ name: string; ieltsFormat: boolean }>): string[] {
  return [...books]
    .sort((a, b) => {
      if (a.ieltsFormat !== b.ieltsFormat) return a.ieltsFormat ? -1 : 1;
      return bookCollator.compare(b.name, a.name);
    })
    .map((book) => book.name);
}

export function compareTitles(a: string, b: string): number {
  return bookCollator.compare(a, b);
}
