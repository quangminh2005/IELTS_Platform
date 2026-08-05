import { describe, expect, it } from "vitest";
import {
  practiceProgressLabel,
  summarizePracticeAttempts,
  summarizeUnfinishedPractice
} from "@/lib/practice-library";

describe("practiceProgressLabel", () => {
  it("chưa luyện lần nào", () => {
    expect(practiceProgressLabel(0, null, 40)).toBe("Chưa luyện");
  });

  it("đã luyện và có điểm cao nhất", () => {
    expect(practiceProgressLabel(3, 32, 40)).toBe("Đã luyện 3 lần · cao nhất 32/40");
  });

  it("đã luyện nhưng chưa có điểm cả-đề (chờ chấm hoặc mới luyện lẻ từng phần)", () => {
    expect(practiceProgressLabel(1, null, 2)).toBe("Đã luyện 1 lần");
  });
});

// Thư viện phải biết phạm vi nào còn lượt LÀM DỞ (và lượt đó có đồng hồ không) thì
// mới hỏi đúng câu hỏi: hỏi "tính giờ hay không" cho một lượt đang dở là hỏi thừa —
// startPractice chỉ nới được đồng hồ chứ không siết được (xem lib/practice.ts).
describe("summarizeUnfinishedPractice", () => {
  it("gộp theo phạm vi, nhớ phạm vi nào đang có đồng hồ", () => {
    const unfinished = summarizeUnfinishedPractice([
      { practiceScopeKey: "student1:material1:all", skillTimeLimitsJson: '{"writing":60}' },
      { practiceScopeKey: "student1:material2:unitA", skillTimeLimitsJson: null }
    ]);

    expect(unfinished.get("student1:material1:all")).toEqual({ timed: true });
    expect(unfinished.get("student1:material2:unitA")).toEqual({ timed: false });
  });

  it("phạm vi không có lượt dở thì vắng mặt trong bản đồ", () => {
    const unfinished = summarizeUnfinishedPractice([
      { practiceScopeKey: "student1:material1:all", skillTimeLimitsJson: null }
    ]);

    expect(unfinished.has("student1:material1:unitA")).toBe(false);
  });

  it("khoá null bị bỏ qua, không làm sập", () => {
    const unfinished = summarizeUnfinishedPractice([
      { practiceScopeKey: null, skillTimeLimitsJson: '{"reading":60}' },
      { practiceScopeKey: "", skillTimeLimitsJson: null }
    ]);

    expect(unfinished.size).toBe(0);
  });

  it("trùng phạm vi: chỉ cần MỘT lượt còn đồng hồ là coi như đang tính giờ", () => {
    const unfinished = summarizeUnfinishedPractice([
      { practiceScopeKey: "student1:material1:all", skillTimeLimitsJson: null },
      { practiceScopeKey: "student1:material1:all", skillTimeLimitsJson: '{"reading":60}' }
    ]);

    expect(unfinished.get("student1:material1:all")).toEqual({ timed: true });
  });
});

describe("summarizePracticeAttempts", () => {
  it("lượt cả-đề đóng góp vào cao nhất, lượt lẻ-một-phần thì không", () => {
    const summary = summarizePracticeAttempts([
      { practiceScopeKey: "student1:material1:all", score: 32 },
      { practiceScopeKey: "student1:material1:unitA", score: 10 }
    ]);

    // Lượt lẻ Part 1 đúng 10/10 KHÔNG được đẩy vào "cao nhất" của cả đề 40 câu,
    // vì thang điểm của nó không cùng phạm vi (mẫu số) với cả đề.
    expect(summary.get("material1")).toEqual({ rounds: 2, bestCorrect: 32 });
  });

  it("chỉ có lượt lẻ-một-phần: rounds > 0 nhưng bestCorrect vẫn null", () => {
    const summary = summarizePracticeAttempts([
      { practiceScopeKey: "student1:material1:unitA", score: 10 },
      { practiceScopeKey: "student1:material1:unitB", score: 8 }
    ]);

    expect(summary.get("material1")).toEqual({ rounds: 2, bestCorrect: null });
  });

  it("vẫn đếm đủ số lượt khi trộn cả lượt cả-đề lẫn lượt lẻ-từng-phần", () => {
    const summary = summarizePracticeAttempts([
      { practiceScopeKey: "student1:material1:all", score: 20 },
      { practiceScopeKey: "student1:material1:unitA", score: 10 },
      { practiceScopeKey: "student1:material1:all", score: 25 },
      { practiceScopeKey: "student1:material1:unitB", score: 7 }
    ]);

    expect(summary.get("material1")).toEqual({ rounds: 4, bestCorrect: 25 });
  });

  it("khoá dị dạng hoặc null không làm sập, không bị tính nhầm", () => {
    const summary = summarizePracticeAttempts([
      { practiceScopeKey: null, score: 40 },
      { practiceScopeKey: "", score: 40 },
      { practiceScopeKey: "chỉ-một-đoạn", score: 40 },
      { practiceScopeKey: "student1:material1:all", score: 15 }
    ]);

    expect(summary.size).toBe(1);
    expect(summary.get("material1")).toEqual({ rounds: 1, bestCorrect: 15 });
  });

  it("score null (bài chờ chấm) không làm hỏng phép lấy cực đại", () => {
    const summary = summarizePracticeAttempts([
      { practiceScopeKey: "student1:material1:all", score: null },
      { practiceScopeKey: "student1:material1:all", score: 18 },
      { practiceScopeKey: "student1:material1:all", score: null }
    ]);

    expect(summary.get("material1")).toEqual({ rounds: 3, bestCorrect: 18 });
  });
});
