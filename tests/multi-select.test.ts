import { describe, expect, it } from "vitest";
import { detectMultiSelectGroups, gradeMultiSelectGroup } from "../lib/multi-select";

// Hai câu "Choose TWO" liên tiếp (cách lưu hiện tại): cùng options, mỗi câu liệt
// kê cả hai đáp án đúng.
const chooseTwoKilns = [
  {
    id: "q17",
    questionType: "multiple_choice",
    options: ["A. function", "B. invented", "C. safe", "D. home", "E. instead"],
    correctAnswers: ["A. function", "E. instead"]
  },
  {
    id: "q18",
    questionType: "multiple_choice",
    options: ["A. function", "B. invented", "C. safe", "D. home", "E. instead"],
    correctAnswers: ["A. function", "E. instead"]
  }
];

describe("detectMultiSelectGroups", () => {
  it("groups a consecutive choose-2 run", () => {
    const groups = detectMultiSelectGroups(chooseTwoKilns);
    expect(groups).toEqual([{ questionIds: ["q17", "q18"], selectCount: 2 }]);
  });

  it("keeps two separate choose-2 tasks apart (different correct sets)", () => {
    const groups = detectMultiSelectGroups([
      ...chooseTwoKilns,
      {
        id: "q19",
        questionType: "multiple_choice",
        options: ["A. hold", "B. buy", "C. essential", "D. names", "E. participants"],
        correctAnswers: ["C. essential", "E. participants"]
      },
      {
        id: "q20",
        questionType: "multiple_choice",
        options: ["A. hold", "B. buy", "C. essential", "D. names", "E. participants"],
        correctAnswers: ["C. essential", "E. participants"]
      }
    ]);
    expect(groups).toEqual([
      { questionIds: ["q17", "q18"], selectCount: 2 },
      { questionIds: ["q19", "q20"], selectCount: 2 }
    ]);
  });

  it("ignores ordinary single-answer multiple choice", () => {
    const groups = detectMultiSelectGroups([
      {
        id: "a",
        questionType: "multiple_choice",
        options: ["A", "B", "C"],
        correctAnswers: ["A"]
      },
      {
        id: "b",
        questionType: "multiple_choice",
        options: ["A", "B", "C"],
        correctAnswers: ["B"]
      }
    ]);
    expect(groups).toEqual([]);
  });

  it("does not group when run length != number of correct answers", () => {
    // 3 câu liên tiếp cùng đáp án {A,E} (|S|=2 != 3) -> không coi là nhóm.
    const three = [chooseTwoKilns[0], chooseTwoKilns[1], { ...chooseTwoKilns[0], id: "q19" }];
    expect(detectMultiSelectGroups(three)).toEqual([]);
  });
});

describe("gradeMultiSelectGroup", () => {
  const correct = ["A. function", "E. instead"];

  it("awards 1 mark per correct distinct letter", () => {
    expect(gradeMultiSelectGroup(["A. function", "E. instead"], correct)).toEqual([true, true]);
    expect(gradeMultiSelectGroup(["A. function", "B. invented"], correct)).toEqual([true, false]);
    expect(gradeMultiSelectGroup(["C. safe", "D. home"], correct)).toEqual([false, false]);
  });

  it("does not double-count a duplicated letter", () => {
    expect(gradeMultiSelectGroup(["A. function", "A. function"], correct)).toEqual([true, false]);
  });

  it("treats empty slots as incorrect", () => {
    expect(gradeMultiSelectGroup(["E. instead", ""], correct)).toEqual([true, false]);
  });

  it("ignores case/whitespace like the normal grader", () => {
    expect(gradeMultiSelectGroup(["  a. FUNCTION ", "e. instead"], correct)).toEqual([true, true]);
  });
});
