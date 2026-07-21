import { describe, expect, it } from "vitest";
import {
  detectMultiSelectGroups,
  gradeMultiPickValue,
  gradeMultiSelectGroup,
  parseMultiPickValue
} from "../lib/multi-select";

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
    expect(groups).toEqual([{ questionIds: ["q17", "q18"], selectCount: 2, mode: "slots" }]);
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
      { questionIds: ["q17", "q18"], selectCount: 2, mode: "slots" },
      { questionIds: ["q19", "q20"], selectCount: 2, mode: "slots" }
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

  // Dạng "Choose TWO answers for each question" (Test 16 câu 11–14): MỘT số câu
  // nhưng hai đáp án đúng, các câu kề nhau có bộ lựa chọn khác nhau.
  it("marks a lone multi-answer question as a joined pick", () => {
    const groups = detectMultiSelectGroups([
      {
        id: "q11",
        questionType: "multiple_choice",
        options: ["A annual", "B a week", "C free", "D spring", "E old"],
        correctAnswers: ["A annual", "C free"]
      },
      {
        id: "q12",
        questionType: "multiple_choice",
        options: ["A Edinburgh", "B 20 years", "C regular", "D 120", "E daily"],
        correctAnswers: ["A Edinburgh", "C regular"]
      }
    ]);
    expect(groups).toEqual([
      { questionIds: ["q11"], selectCount: 2, mode: "joined" },
      { questionIds: ["q12"], selectCount: 2, mode: "joined" }
    ]);
  });

  it("does not treat accepted spelling variants as a joined pick", () => {
    // Đáp án phụ không nằm trong options → vẫn là câu chọn một.
    const groups = detectMultiSelectGroups([
      {
        id: "q1",
        questionType: "multiple_choice",
        options: ["A cats", "B dogs"],
        correctAnswers: ["A cats", "cats"]
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

describe("gradeMultiPickValue", () => {
  const correct = ["A is an annual event", "C is a free event"];

  it("chỉ đúng khi chọn đủ và đúng cả hai chữ", () => {
    expect(gradeMultiPickValue("A is an annual event | C is a free event", correct)).toBe(true);
    // Thứ tự chọn không quan trọng.
    expect(gradeMultiPickValue("C is a free event | A is an annual event", correct)).toBe(true);
  });

  it("thiếu, thừa hoặc sai một chữ đều 0 điểm", () => {
    expect(gradeMultiPickValue("A is an annual event", correct)).toBe(false);
    expect(gradeMultiPickValue("A is an annual event | D happens in spring", correct)).toBe(false);
    expect(
      gradeMultiPickValue("A is an annual event | C is a free event | D happens in spring", correct)
    ).toBe(false);
    expect(gradeMultiPickValue("", correct)).toBe(false);
  });

  it("bỏ qua hoa thường và khoảng trắng thừa", () => {
    expect(gradeMultiPickValue("  c IS A free EVENT |a is an annual event ", correct)).toBe(true);
  });
});

describe("parseMultiPickValue", () => {
  it("tách chuỗi nối và bỏ ô rỗng", () => {
    expect(parseMultiPickValue("A cans | E paint")).toEqual(["A cans", "E paint"]);
    expect(parseMultiPickValue("")).toEqual([]);
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
