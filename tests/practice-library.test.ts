import { describe, expect, it } from "vitest";
import {
  countByQuestionGroup,
  materialCoverText,
  parseQuestionGroupParam,
  partLabelOf,
  partNumberOf,
  sortBooks,
  summarizeUnitProgress,
  unitCardText,
  practiceProgressLabel,
  questionGroupsOf,
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

// Lọc thư viện tự luyện theo dạng câu (kiểu youpass.vn).
describe("lọc theo dạng câu", () => {
  it("gộp questionType thành nhóm, bỏ trùng, giữ thứ tự hiển thị, bỏ dạng chấm tay", () => {
    expect(
      questionGroupsOf([
        "note_completion",
        "true_false_not_given",
        "writing_task",
        "gap_fill",
        "multiple_choice",
        "drag_drop_matching"
      ])
    ).toEqual(["multiple_choice", "true_false", "matching", "completion"]);
    expect(questionGroupsOf(["speaking_task"])).toEqual([]);
  });

  it("chỉ nhận ?type= hợp lệ", () => {
    expect(parseQuestionGroupParam("true_false")).toBe("true_false");
    expect(parseQuestionGroupParam("true_false_not_given")).toBeNull();
    expect(parseQuestionGroupParam(undefined)).toBeNull();
  });

  it("đếm số đề mỗi dạng, bỏ dạng không có đề", () => {
    expect(
      countByQuestionGroup([
        { questionGroups: ["true_false", "completion"] },
        { questionGroups: ["completion"] },
        { questionGroups: [] }
      ])
    ).toEqual([
      { key: "true_false", label: "True/False/Not Given", count: 1 },
      { key: "completion", label: "Điền từ", count: 2 }
    ]);
  });
});

describe("bộ lọc kiểu chin: Part / bộ sách / bìa thẻ", () => {
  it("đọc số Part từ đủ kiểu tên unit", () => {
    expect(partNumberOf("Listening Section 1 – Reporting a stolen briefcase")).toBe(1);
    expect(partNumberOf("Listening Part 4 – The spirit bear")).toBe(4);
    expect(partNumberOf("Passage 3 – The psychology of innovation")).toBe(3);
    expect(partNumberOf("Part Two – Clubs for students")).toBe(2);
    expect(partNumberOf("Writing Task 2 – Long school holidays")).toBe(2);
    expect(partNumberOf("Unit 12  Acid Rain!")).toBeNull();
  });

  it("nhãn Part theo kỹ năng", () => {
    expect(partLabelOf("listening", 1)).toBe("Part 1");
    expect(partLabelOf("reading", 2)).toBe("Passage 2");
    expect(partLabelOf("writing", 1)).toBe("Task 1");
  });

  it("tách nhãn + chủ đề trên thẻ", () => {
    expect(unitCardText("listening", "Listening Part 1 – Self-drive tours in the USA")).toEqual({
      badge: "Part 1",
      topic: "Self-drive tours in the USA"
    });
    expect(unitCardText("listening", "Unit 3  Growing Roses")).toEqual({
      badge: "Unit 3",
      topic: "Growing Roses"
    });
    expect(unitCardText("reading", "Bài đọc tự soạn")).toEqual({ badge: null, topic: "Bài đọc tự soạn" });
  });

  it("chữ trên bìa thẻ full test", () => {
    expect(materialCoverText("Cambridge IELTS 10 – Test 1 (Listening)")).toEqual({
      kicker: "Cambridge IELTS",
      big: "10",
      sub: "Test 1"
    });
    expect(materialCoverText("Listening Practice Through Dictation 3")).toEqual({
      kicker: "Listening Practice Through Dictation",
      big: "3",
      sub: ""
    });
    expect(materialCoverText("Đề tự luyện")).toEqual({ kicker: "Đề tự luyện", big: null, sub: "" });
  });

  it("tab bộ sách: bộ đề IELTS trước, số lớn trước", () => {
    expect(
      sortBooks([
        { name: "Listening Practice Through Dictation", ieltsFormat: false },
        { name: "Cambridge IELTS 1", ieltsFormat: true },
        { name: "Cambridge IELTS 20", ieltsFormat: true },
        { name: "Cambridge IELTS 10", ieltsFormat: true }
      ])
    ).toEqual([
      "Cambridge IELTS 20",
      "Cambridge IELTS 10",
      "Cambridge IELTS 1",
      "Listening Practice Through Dictation"
    ]);
  });

  it("tiến độ từng Part: luyện cả đề cũng tính cho mọi Part", () => {
    const progress = summarizeUnitProgress(
      [
        { practiceScopeKey: "s1:m1:all", correctByUnit: { u1: 7, u2: 4 } },
        { practiceScopeKey: "s1:m1:u1", correctByUnit: { u1: 9 } },
        { practiceScopeKey: null, correctByUnit: { u1: 10 } }
      ],
      new Map([["m1", ["u1", "u2", "u3"]]])
    );
    expect(progress.get("u1")).toEqual({ rounds: 2, bestCorrect: 9 });
    expect(progress.get("u2")).toEqual({ rounds: 1, bestCorrect: 4 });
    expect(progress.get("u3")).toEqual({ rounds: 1, bestCorrect: 0 });
  });
});
