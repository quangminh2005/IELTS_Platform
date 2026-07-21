import { normalizeAnswer } from "./grading";

// Nhận diện các câu "Choose N letters" đang được lưu thành N câu multiple_choice
// liên tiếp (mỗi câu cùng bộ options và cùng tập đáp án đúng gồm N chữ). Xem
// docs/superpowers/specs/2026-07-02-multi-select-choose-two-design.md.

export type MultiSelectGroup = {
  questionIds: string[];
  selectCount: number;
  // "slots"  = N số câu liên tiếp, mỗi câu giữ MỘT chữ đã chọn (mỗi chữ 1 điểm).
  // "joined" = CHỈ MỘT số câu nhưng phải chọn N chữ (vd "Choose TWO answers for
  //            each question"): cả N chữ lưu chung một ô, nối bằng MULTI_PICK_SEPARATOR,
  //            và chỉ được điểm khi chọn ĐÚNG CẢ N chữ.
  mode: "slots" | "joined";
};

// Dấu nối các lựa chọn trong một ô "joined" — trùng với cách answerSnapshot nối
// đáp án đúng, nên trang kết quả hiện hai bên cùng một định dạng.
export const MULTI_PICK_SEPARATOR = " | ";

export function parseMultiPickValue(value: string): string[] {
  return value
    .split("|")
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0);
}

export function formatMultiPickValue(values: string[]): string {
  return values.join(MULTI_PICK_SEPARATOR);
}

export type DetectQuestion = {
  id: string;
  questionType: string;
  options: string[];
  correctAnswers: string[];
};

function sameOptions(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((option, index) => option === b[index]);
}

function normalizedSet(values: string[]): Set<string> {
  return new Set(values.map(normalizeAnswer).filter((value) => value.length > 0));
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((value) => b.has(value));
}

export function detectMultiSelectGroups(questions: DetectQuestion[]): MultiSelectGroup[] {
  const groups: MultiSelectGroup[] = [];
  let i = 0;

  while (i < questions.length) {
    const start = questions[i];

    if (start.questionType !== "multiple_choice") {
      i += 1;
      continue;
    }

    const correctSet = normalizedSet(start.correctAnswers);

    // Dãy liên tiếp cùng options VÀ cùng tập đáp án đúng.
    let end = i + 1;
    while (
      end < questions.length &&
      questions[end].questionType === "multiple_choice" &&
      sameOptions(questions[end].options, start.options) &&
      sameSet(normalizedSet(questions[end].correctAnswers), correctSet)
    ) {
      end += 1;
    }

    const runLength = end - i;
    const optionSet = normalizedSet(start.options);
    const isSubsetOfOptions = [...correctSet].every((value) => optionSet.has(value));

    // "Choose N": số câu trong dãy = số đáp án đúng (≥ 2), và đáp án nằm trong options.
    if (runLength >= 2 && runLength === correctSet.size && isSubsetOfOptions) {
      groups.push({
        questionIds: questions.slice(i, end).map((question) => question.id),
        selectCount: runLength,
        mode: "slots"
      });
      i = end;
    } else if (runLength === 1 && correctSet.size >= 2 && isSubsetOfOptions) {
      // Một số câu duy nhất nhưng có ≥ 2 đáp án đúng → dạng "mỗi câu chọn N chữ".
      groups.push({
        questionIds: [start.id],
        selectCount: correctSet.size,
        mode: "joined"
      });
      i += 1;
    } else if (runLength >= 2) {
      // Dãy cùng đáp án nhưng độ dài không khớp số đáp án đúng (dữ liệu bất
      // thường) → bỏ qua cả dãy, tránh gom nhầm một dãy con tuỳ tiện.
      i = end;
    } else {
      i += 1;
    }
  }

  return groups;
}

// Chấm một ô "joined" (một số câu, chọn N chữ): chỉ đúng khi tập chữ đã chọn
// TRÙNG KHỚP tập đáp án đúng — thiếu, thừa hay sai một chữ đều 0 điểm.
export function gradeMultiPickValue(value: string, correctAnswers: string[]): boolean {
  const picked = normalizedSet(parseMultiPickValue(value));
  return picked.size > 0 && sameSet(picked, normalizedSet(correctAnswers));
}

// Chấm một nhóm chọn-N theo tập: mỗi chữ đúng phân biệt được 1 điểm (chấm phần),
// loại trùng, slot trống = 0. Trả về mảng isCorrect theo thứ tự slot đầu vào.
export function gradeMultiSelectGroup(slotValues: string[], correctAnswers: string[]): boolean[] {
  const correctSet = normalizedSet(correctAnswers);
  const credited = new Set<string>();

  return slotValues.map((value) => {
    const normalized = normalizeAnswer(value);

    if (normalized && correctSet.has(normalized) && !credited.has(normalized)) {
      credited.add(normalized);
      return true;
    }

    return false;
  });
}
