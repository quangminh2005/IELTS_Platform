import { normalizeAnswer } from "./grading";

// Nhận diện các câu "Choose N letters" đang được lưu thành N câu multiple_choice
// liên tiếp (mỗi câu cùng bộ options và cùng tập đáp án đúng gồm N chữ). Xem
// docs/superpowers/specs/2026-07-02-multi-select-choose-two-design.md.

export type MultiSelectGroup = {
  questionIds: string[];
  selectCount: number;
};

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
        selectCount: runLength
      });
      i = end;
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
