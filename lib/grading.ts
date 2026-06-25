export type GradeResult = {
  isCorrect: boolean;
  pointsAwarded: number;
};

export type AttemptItem = {
  value: string;
  correctAnswers: string[];
  points: number;
};

export type AttemptGrade = {
  score: number;
  maxScore: number;
  scorePercent: number;
};

export function normalizeAnswer(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function gradeAnswer(
  value: string,
  correctAnswers: string[],
  points = 1,
): GradeResult {
  const normalizedValue = normalizeAnswer(value);

  if (!normalizedValue) {
    return { isCorrect: false, pointsAwarded: 0 };
  }

  const isCorrect = correctAnswers.some(
    (answer) => normalizeAnswer(answer) === normalizedValue,
  );

  return {
    isCorrect,
    pointsAwarded: isCorrect ? points : 0,
  };
}

export function gradeAttempt(items: AttemptItem[]): AttemptGrade {
  const score = items.reduce(
    (total, item) =>
      total + gradeAnswer(item.value, item.correctAnswers, item.points).pointsAwarded,
    0,
  );
  const maxScore = items.reduce((total, item) => total + item.points, 0);

  return {
    score,
    maxScore,
    scorePercent: maxScore === 0 ? 0 : Math.round((score / maxScore) * 100),
  };
}
