import { calculateVocabStreak } from "@/lib/vocab-streak";

// Số liệu "ôn từ vựng" mà GIÁO VIÊN nhìn thấy trong trang Tự luyện: mỗi học viên
// một dòng. Tách khỏi UI để test được. Giống lib/practice-progress.ts, đây là đo
// mức độ chăm chỉ (có ngồi ôn hay không), không đo trình độ.

export type VocabStudentInput = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  avatarPreset: string | null;
  userImage: string | null;
};

// Một ngày có làm quiz (VocabQuizDay), date dạng "YYYY-MM-DD" giờ VN.
export type VocabQuizDayInput = {
  studentId: string;
  date: string;
  correct: number;
  total: number;
};

export type VocabProgressInput = {
  studentId: string;
  correctCount: number;
  wrongCount: number;
};

export type VocabStudentRow = VocabStudentInput & {
  // Số ngày có ôn trong khoảng đang xem.
  daysInRange: number;
  // Chuỗi ngày ôn liên tiếp tính đến hôm nay.
  streakDays: number;
  wordsSeen: number;
  // % câu đúng trên mọi lượt ôn; null khi chưa ôn lần nào.
  accuracyPercent: number | null;
  lastQuizDate: string | null;
};

export function buildVocabStudentRows(
  students: VocabStudentInput[],
  quizDays: VocabQuizDayInput[],
  progress: VocabProgressInput[],
  options: { today: string; rangeStartKey: string | null }
): VocabStudentRow[] {
  const daysByStudent = new Map<string, VocabQuizDayInput[]>();

  for (const day of quizDays) {
    const bucket = daysByStudent.get(day.studentId) ?? [];
    bucket.push(day);
    daysByStudent.set(day.studentId, bucket);
  }

  const progressByStudent = new Map<string, { words: number; correct: number; wrong: number }>();

  for (const row of progress) {
    const current = progressByStudent.get(row.studentId) ?? { words: 0, correct: 0, wrong: 0 };
    current.words += 1;
    current.correct += row.correctCount;
    current.wrong += row.wrongCount;
    progressByStudent.set(row.studentId, current);
  }

  const rows = students.map((student): VocabStudentRow => {
    const days = daysByStudent.get(student.id) ?? [];
    const stats = progressByStudent.get(student.id);
    const answered = (stats?.correct ?? 0) + (stats?.wrong ?? 0);
    const lastQuizDate = days.reduce<string | null>(
      (latest, day) => (latest === null || day.date > latest ? day.date : latest),
      null
    );

    return {
      ...student,
      daysInRange: days.filter(
        (day) => options.rangeStartKey === null || day.date >= options.rangeStartKey
      ).length,
      streakDays: calculateVocabStreak({
        days: days.map((day) => day.date),
        today: options.today
      }).days,
      wordsSeen: stats?.words ?? 0,
      accuracyPercent:
        answered > 0 ? Math.round(((stats?.correct ?? 0) / answered) * 100) : null,
      lastQuizDate
    };
  });

  // Em ôn gần đây nhất lên đầu; chưa ôn bao giờ xuống cuối; cùng mốc thì theo tên.
  return rows.sort((left, right) => {
    if (left.lastQuizDate !== right.lastQuizDate) {
      if (left.lastQuizDate === null) {
        return 1;
      }

      if (right.lastQuizDate === null) {
        return -1;
      }

      return left.lastQuizDate < right.lastQuizDate ? 1 : -1;
    }

    return left.displayName.localeCompare(right.displayName, "vi");
  });
}

export function vocabTotals(rows: VocabStudentRow[]): {
  activeStudents: number;
  totalStudents: number;
} {
  return {
    activeStudents: rows.filter((row) => row.daysInRange > 0).length,
    totalStudents: rows.length
  };
}
