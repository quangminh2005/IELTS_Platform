import type { Prisma } from "@prisma/client";
import { parseUnitImages, parseWritingBrief } from "@/lib/question-interactions";
import { resolveWritingTaskNumber } from "@/lib/writing-review";
import type { GradingAnswer, GradingInput, GradingTaskInput } from "@/lib/ai-grading/types";

// Các cột Answer cần để dựng đầu vào chấm (dùng chung ở grade-attempt.ts).
export const ANSWER_ROW_SELECT = {
  id: true,
  value: true,
  transcript: true,
  isCorrect: true,
  question: { select: { order: true, prompt: true } },
  assignableUnit: {
    select: {
      id: true,
      title: true,
      skill: true,
      unitNumber: true,
      content: true,
      instructions: true,
      metadataJson: true
    }
  }
} satisfies Prisma.AnswerSelect;

export type AnswerRow = {
  id: string;
  value: string;
  transcript: string | null;
  isCorrect: boolean | null;
  question: { order: number; prompt: string } | null;
  assignableUnit: {
    id: string;
    title: string;
    skill: string;
    unitNumber: number;
    content: string;
    instructions: string | null;
    metadataJson: string | null;
  };
};

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// Ảnh gửi cho model phải là https hoặc data URI ảnh — đường dẫn tương đối model không mở được.
// OpenAI chỉ nhận PNG/JPEG/WebP/GIF: đề có biểu đồ vẽ lại bằng SVG (data:image/svg+xml)
// mà gửi đi là hỏng cả lượt, nên bỏ qua (model vẫn chấm được từ phần chữ của đề).
function usableImage(url: string): boolean {
  if (url.startsWith("data:")) {
    return /^data:image\/(png|jpe?g|webp|gif)[;,]/i.test(url);
  }
  return url.startsWith("https://") && !/\.svg(\?|#|$)/i.test(url);
}

// Dựng đầu vào một lượt chấm từ các câu trả lời của lần nộp. Chỉ lấy câu chấm tay
// (isCorrect === null) như trang chấm; có Speaking thì chấm Speaking (giống reviewSkill).
export function buildGradingInput(rows: AnswerRow[]): GradingInput | null {
  const manual = rows.filter(
    (row) =>
      row.isCorrect === null &&
      (row.assignableUnit.skill === "writing" || row.assignableUnit.skill === "speaking")
  );
  const skill = manual.some((row) => row.assignableUnit.skill === "speaking") ? "speaking" : "writing";
  const essays = manual.filter((row) => row.assignableUnit.skill === skill);
  let refCounter = 0;
  const nextRef = () => `A${(refCounter += 1)}`;

  if (skill === "speaking") {
    const ordered = [...essays].sort(
      (a, b) =>
        a.assignableUnit.unitNumber - b.assignableUnit.unitNumber ||
        (a.question?.order ?? 0) - (b.question?.order ?? 0)
    );
    const answers: GradingAnswer[] = ordered
      .filter((row) => (row.transcript ?? "").trim().length > 0)
      .map((row) => ({
        answerId: row.id,
        ref: nextRef(),
        questionPrompt: row.question
          ? `${row.assignableUnit.title} · ${row.question.prompt}`
          : row.assignableUnit.title,
        text: (row.transcript ?? "").trim()
      }));

    if (answers.length === 0) return null;

    return {
      skill,
      tasks: [{ unitId: "", label: "Speaking", taskNumber: null, prompt: "", images: [], minWords: null, answers }]
    };
  }

  const byUnit = new Map<string, AnswerRow[]>();
  for (const row of essays) {
    if (!row.value.trim()) continue;
    const list = byUnit.get(row.assignableUnit.id) ?? [];
    list.push(row);
    byUnit.set(row.assignableUnit.id, list);
  }

  const units = Array.from(byUnit.values())
    .map((list) => {
      const unit = list[0].assignableUnit;
      const resolved = resolveWritingTaskNumber(unit.title, unit.unitNumber);
      const taskNumber: 1 | 2 | null = resolved === 1 || resolved === 2 ? resolved : null;
      return { list, unit, taskNumber };
    })
    .sort(
      (a, b) =>
        (a.taskNumber ?? 99) - (b.taskNumber ?? 99) || a.unit.unitNumber - b.unit.unitNumber
    );

  const tasks: GradingTaskInput[] = units.map(({ list, unit, taskNumber }) => ({
    unitId: unit.id,
    label: unit.title,
    taskNumber,
    prompt: [unit.instructions, unit.content].filter((part) => part && part.trim()).join("\n\n"),
    images: parseUnitImages(unit.metadataJson).filter(usableImage),
    minWords: parseWritingBrief(unit.metadataJson).minWords,
    answers: list.map((row) => ({
      answerId: row.id,
      ref: nextRef(),
      questionPrompt: row.question?.prompt ?? null,
      text: row.value.trim()
    }))
  }));

  return tasks.length > 0 ? { skill, tasks } : null;
}
