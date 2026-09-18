import { describe, expect, it } from "vitest";
import {
  buildVocabStudentRows,
  vocabTotals,
  type VocabStudentInput
} from "../lib/vocab-teacher-stats";

const student = (id: string, displayName: string): VocabStudentInput => ({
  id,
  displayName,
  avatarUrl: null,
  avatarPreset: null,
  userImage: null
});

const students = [student("s1", "An"), student("s2", "Bình"), student("s3", "Chi")];

const quizDays = [
  { studentId: "s1", date: "2026-09-18", correct: 4, total: 5 },
  { studentId: "s1", date: "2026-09-17", correct: 5, total: 5 },
  { studentId: "s1", date: "2026-09-10", correct: 3, total: 5 },
  { studentId: "s2", date: "2026-09-01", correct: 2, total: 5 }
];

const progress = [
  { studentId: "s1", correctCount: 3, wrongCount: 1 },
  { studentId: "s1", correctCount: 1, wrongCount: 0 },
  { studentId: "s2", correctCount: 0, wrongCount: 2 }
];

const build = (rangeStartKey: string | null = null) =>
  buildVocabStudentRows(students, quizDays, progress, { today: "2026-09-18", rangeStartKey });

describe("buildVocabStudentRows", () => {
  it("em ôn gần nhất lên đầu, chưa ôn bao giờ xuống cuối", () => {
    expect(build().map((row) => row.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("đếm số ngày ôn trong khoảng", () => {
    const rows = build("2026-09-12");
    expect(rows.find((row) => row.id === "s1")?.daysInRange).toBe(2);
    expect(rows.find((row) => row.id === "s2")?.daysInRange).toBe(0);
  });

  it("không giới hạn khoảng thì đếm hết", () => {
    expect(build().find((row) => row.id === "s1")?.daysInRange).toBe(3);
  });

  it("chuỗi ngày liên tiếp tính đến hôm nay", () => {
    expect(build().find((row) => row.id === "s1")?.streakDays).toBe(2);
    expect(build().find((row) => row.id === "s2")?.streakDays).toBe(0);
  });

  it("từ đã gặp, tỉ lệ đúng và lần ôn gần nhất", () => {
    const s1 = build().find((row) => row.id === "s1")!;
    expect(s1.wordsSeen).toBe(2);
    expect(s1.accuracyPercent).toBe(80);
    expect(s1.lastQuizDate).toBe("2026-09-18");
  });

  it("chưa ôn thì tỉ lệ null và không có ngày", () => {
    const s3 = build().find((row) => row.id === "s3")!;
    expect(s3.accuracyPercent).toBeNull();
    expect(s3.lastQuizDate).toBeNull();
    expect(s3.wordsSeen).toBe(0);
  });
});

describe("vocabTotals", () => {
  it("đếm em có ôn trong khoảng trên tổng số", () => {
    expect(vocabTotals(build("2026-09-12"))).toEqual({ activeStudents: 1, totalStudents: 3 });
    expect(vocabTotals(build())).toEqual({ activeStudents: 2, totalStudents: 3 });
  });
});
