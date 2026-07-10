import { gradeAnswer, type AttemptItem } from "@/lib/grading";
import { detectMultiSelectGroups, gradeMultiSelectGroup } from "@/lib/multi-select";
import { parseQuestionOptions } from "@/lib/question-interactions";

export type QuestionForGrading = {
  id: string;
  order: number;
  questionType: string;
  optionsJson: string | null;
  correctAnswerJson: string | null;
  explanation: string | null;
  points: number;
};

export type UnitForGrading = {
  assignableUnitId: string;
  skill: string;
  questions: QuestionForGrading[];
};

export type GradedAnswerRow = {
  questionId: string;
  assignableUnitId: string;
  value: string;
  isCorrect: boolean | null;
  pointsAwarded: number | null;
  correctAnswerSnapshot: string | null;
  explanationSnapshot: string | null;
};

export type GradedUnits = {
  answerRows: GradedAnswerRow[];
  gradeItems: AttemptItem[];
};

export function parseCorrectAnswers(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((a) => String(a));
    if (["string", "number", "boolean"].includes(typeof parsed)) return [String(parsed)];
  } catch {
    return [value];
  }
  return [];
}

function answerSnapshot(value: string | null): string | null {
  const answers = parseCorrectAnswers(value);
  return answers.length > 0 ? answers.join(" | ") : value;
}

function isManualGradedSkill(skill: string): boolean {
  return skill === "writing" || skill === "speaking";
}

// Chấm một tập unit (cùng hoặc khác kỹ năng). getValue trả giá trị học sinh nhập
// theo questionId. Trả về answerRows (ghi DB) + gradeItems (gộp điểm bằng gradeAttempt).
export function gradeUnits(
  units: UnitForGrading[],
  getValue: (questionId: string) => string
): GradedUnits {
  const answerRows: GradedAnswerRow[] = [];
  const gradeItems: AttemptItem[] = [];

  for (const unit of units) {
    const questions = unit.questions;
    const isManualSkill = isManualGradedSkill(unit.skill);

    const groupResult = new Map<string, { isCorrect: boolean; pointsAwarded: number }>();
    if (!isManualSkill) {
      const groups = detectMultiSelectGroups(
        questions.map((q) => ({
          id: q.id,
          questionType: q.questionType,
          options: parseQuestionOptions(q.optionsJson),
          correctAnswers: parseCorrectAnswers(q.correctAnswerJson)
        }))
      );

      for (const group of groups) {
        const slotValues = group.questionIds.map((id) => getValue(id).trim());
        const firstMember = questions.find((q) => q.id === group.questionIds[0]);
        const correctSet = parseCorrectAnswers(firstMember?.correctAnswerJson ?? null);
        const marks = gradeMultiSelectGroup(slotValues, correctSet);
        group.questionIds.forEach((id, index) => {
          const points = questions.find((q) => q.id === id)?.points ?? 1;
          groupResult.set(id, {
            isCorrect: marks[index],
            pointsAwarded: marks[index] ? points : 0
          });
        });
      }
    }

    for (const question of questions) {
      const value = getValue(question.id).trim();

      if (isManualSkill) {
        answerRows.push({
          questionId: question.id,
          assignableUnitId: unit.assignableUnitId,
          value,
          isCorrect: null,
          pointsAwarded: null,
          correctAnswerSnapshot: null,
          explanationSnapshot: question.explanation
        });
        continue;
      }

      const correctAnswers = parseCorrectAnswers(question.correctAnswerJson);
      const group = groupResult.get(question.id);
      const grade = group ?? gradeAnswer(value, correctAnswers, question.points);

      answerRows.push({
        questionId: question.id,
        assignableUnitId: unit.assignableUnitId,
        value,
        isCorrect: grade.isCorrect,
        pointsAwarded: grade.pointsAwarded,
        correctAnswerSnapshot: answerSnapshot(question.correctAnswerJson),
        explanationSnapshot: question.explanation
      });

      gradeItems.push(
        group
          ? {
              value: group.isCorrect ? value || "1" : "",
              correctAnswers: group.isCorrect ? [value || "1"] : [],
              points: question.points
            }
          : { value, correctAnswers, points: question.points }
      );
    }
  }

  return { answerRows, gradeItems };
}
