import { parsePracticeScopeKey } from "@/lib/practice";

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
  // null = chưa có lượt nào đang dở ở phần này.
  resume: PracticeResumeState | null;
};

export type PracticeMaterialItem = {
  id: string;
  title: string;
  skill: string;
  sourceLabel: string | null;
  unitCount: number;
  questionCount: number;
  progressLabel: string;
  // Lượt đang dở của phạm vi CẢ ĐỀ (phạm vi từng phần nằm ở units[].resume).
  resume: PracticeResumeState | null;
  units: PracticeUnitItem[];
};
