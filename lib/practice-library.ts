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

  if (bestCorrect === null) {
    return `${lan} · chờ chấm`;
  }

  return `${lan} · cao nhất ${bestCorrect}/${totalQuestions}`;
}

export type PracticeUnitItem = {
  id: string;
  title: string;
  questionCount: number;
};

export type PracticeMaterialItem = {
  id: string;
  title: string;
  skill: string;
  sourceLabel: string | null;
  unitCount: number;
  questionCount: number;
  progressLabel: string;
  units: PracticeUnitItem[];
};
