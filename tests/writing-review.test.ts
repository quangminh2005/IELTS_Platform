import { describe, expect, it } from "vitest";
import {
  WRITING_CRITERIA,
  SPEAKING_CRITERIA,
  criteriaForScores,
  overallBandFromTasks,
  parseReviewCriteria,
  resolveWritingTaskNumber,
  roundToHalfBand,
  serializeReviewCriteria,
  taskBand,
  taskWeights,
  type ReviewTask
} from "../lib/writing-review";

function writingScores(
  taskAchievement: number,
  coherence: number,
  lexicalResource: number,
  grammar: number
) {
  return { taskAchievement, coherence, lexicalResource, grammar };
}

function task(overrides: Partial<ReviewTask> & { scores: ReviewTask["scores"] }): ReviewTask {
  return { unitId: "", label: "", taskNumber: null, ...overrides };
}

describe("roundToHalfBand", () => {
  it("làm tròn .25 lên .5 và .75 lên số nguyên kế (luật IELTS)", () => {
    expect(roundToHalfBand(6.25)).toBe(6.5);
    expect(roundToHalfBand(6.75)).toBe(7);
    expect(roundToHalfBand(6.5)).toBe(6.5);
    expect(roundToHalfBand(6.1)).toBe(6);
  });
});

describe("taskBand", () => {
  it("trung bình 4 tiêu chí, làm tròn 0.5", () => {
    expect(taskBand(writingScores(6, 6, 6, 5), WRITING_CRITERIA)).toBe(6);
    expect(taskBand(writingScores(6, 6, 5, 5), WRITING_CRITERIA)).toBe(5.5);
  });

  it("thiếu tiêu chí nào thì chưa tính", () => {
    expect(taskBand({ taskAchievement: 6, coherence: 6 }, WRITING_CRITERIA)).toBeNull();
    expect(taskBand({}, WRITING_CRITERIA)).toBeNull();
  });

  it("dùng đúng bộ tiêu chí Speaking", () => {
    expect(
      taskBand(
        { fluency: 7, lexicalResource: 7, grammar: 6, pronunciation: 7 },
        SPEAKING_CRITERIA
      )
    ).toBe(7);
  });
});

describe("taskWeights", () => {
  it("nhân trọng số 1:2 khi có đúng một Task 1 và một Task 2", () => {
    expect(taskWeights([{ taskNumber: 1 }, { taskNumber: 2 }])).toEqual({
      weights: [1, 2],
      weighted: true
    });
  });

  it("giữ nguyên trọng số dù Task 2 đứng trước", () => {
    expect(taskWeights([{ taskNumber: 2 }, { taskNumber: 1 }])).toEqual({
      weights: [2, 1],
      weighted: true
    });
  });

  it("chia đều khi không nhận ra đủ Task 1 + Task 2", () => {
    expect(taskWeights([{ taskNumber: 1 }, { taskNumber: 1 }])).toEqual({
      weights: [1, 1],
      weighted: false
    });
    expect(taskWeights([{ taskNumber: null }])).toEqual({ weights: [1], weighted: false });
  });
});

describe("overallBandFromTasks", () => {
  it("Writing đủ 2 task: (T1 + T2 × 2) / 3", () => {
    // Task 1 = 6.0, Task 2 = 7.0 → (6 + 14) / 3 = 6.67 → 6.5
    const result = overallBandFromTasks(
      [
        task({ taskNumber: 1, scores: writingScores(6, 6, 6, 6) }),
        task({ taskNumber: 2, scores: writingScores(7, 7, 7, 7) })
      ],
      WRITING_CRITERIA
    );

    expect(result).toEqual({ band: 6.5, weighted: true });
  });

  it("khác hẳn trung bình cộng — đây chính là lỗi cũ", () => {
    // Task 1 = 5.0, Task 2 = 7.0. Trung bình cộng = 6.0, đúng luật = (5 + 14)/3 = 6.33 → 6.5
    const result = overallBandFromTasks(
      [
        task({ taskNumber: 1, scores: writingScores(5, 5, 5, 5) }),
        task({ taskNumber: 2, scores: writingScores(7, 7, 7, 7) })
      ],
      WRITING_CRITERIA
    );

    expect(result.band).toBe(6.5);
    expect(result.band).not.toBe(6);
  });

  it("một task duy nhất = band của chính task đó", () => {
    expect(
      overallBandFromTasks(
        [task({ taskNumber: 2, scores: writingScores(6, 7, 6, 6) })],
        WRITING_CRITERIA
      )
    ).toEqual({ band: 6.5, weighted: false });
  });

  it("còn task chưa chấm đủ tiêu chí thì chưa tính band tổng", () => {
    expect(
      overallBandFromTasks(
        [
          task({ taskNumber: 1, scores: writingScores(6, 6, 6, 6) }),
          task({ taskNumber: 2, scores: { taskAchievement: 7 } })
        ],
        WRITING_CRITERIA
      ).band
    ).toBeNull();
  });

  it("không có task nào thì null", () => {
    expect(overallBandFromTasks([], WRITING_CRITERIA).band).toBeNull();
  });
});

describe("parseReviewCriteria / serializeReviewCriteria", () => {
  it("đọc được bản ghi cũ dạng phẳng", () => {
    expect(parseReviewCriteria('{"taskAchievement":6,"coherence":5.5}')).toEqual([
      { unitId: "", label: "", taskNumber: null, scores: { taskAchievement: 6, coherence: 5.5 } }
    ]);
  });

  it("một phần thì ghi lại đúng dạng phẳng cũ", () => {
    expect(
      serializeReviewCriteria([task({ scores: { taskAchievement: 6, coherence: 6 } })])
    ).toBe('{"taskAchievement":6,"coherence":6}');
  });

  it("nhiều phần thì ghi dạng v2 và đọc lại nguyên vẹn", () => {
    const tasks: ReviewTask[] = [
      { unitId: "u1", label: "Task 1 – Line graph", taskNumber: 1, scores: writingScores(6, 6, 6, 6) },
      { unitId: "u2", label: "Task 2 – Essay", taskNumber: 2, scores: writingScores(7, 7, 6, 7) }
    ];

    const json = serializeReviewCriteria(tasks);
    expect(JSON.parse(json).version).toBe(2);
    expect(parseReviewCriteria(json)).toEqual(tasks);
  });

  it("bỏ phần chưa chấm điểm nào", () => {
    expect(
      serializeReviewCriteria([
        task({ unitId: "u1", scores: { taskAchievement: 6 } }),
        task({ unitId: "u2", scores: {} })
      ])
    ).toBe('{"taskAchievement":6}');

    expect(serializeReviewCriteria([task({ scores: {} })])).toBe("");
  });

  it("chịu được JSON hỏng / rỗng", () => {
    expect(parseReviewCriteria(null)).toEqual([]);
    expect(parseReviewCriteria("")).toEqual([]);
    expect(parseReviewCriteria("không phải json")).toEqual([]);
    expect(parseReviewCriteria("{}")).toEqual([]);
    expect(parseReviewCriteria('{"taskAchievement":"giỏi"}')).toEqual([]);
  });
});

describe("criteriaForScores", () => {
  it("nhận ra Speaking qua tên tiêu chí", () => {
    expect(criteriaForScores({ fluency: 6 })).toBe(SPEAKING_CRITERIA);
    expect(criteriaForScores({ pronunciation: 6 })).toBe(SPEAKING_CRITERIA);
    expect(criteriaForScores({ taskAchievement: 6 })).toBe(WRITING_CRITERIA);
  });
});

describe("resolveWritingTaskNumber", () => {
  it("ưu tiên chữ Task trong tên phần", () => {
    expect(resolveWritingTaskNumber("Task 2 – Opinion essay", 1)).toBe(2);
    expect(resolveWritingTaskNumber("WRITING TASK 1", 5)).toBe(1);
    expect(resolveWritingTaskNumber("Task1 không có dấu cách", 2)).toBe(1);
  });

  it("không có chữ Task thì lấy unitNumber nếu là 1 hoặc 2", () => {
    expect(resolveWritingTaskNumber("Line graph – Households with a car", 1)).toBe(1);
    expect(resolveWritingTaskNumber("Line graph – Households with a car", 2)).toBe(2);
  });

  it("không đoán được thì null", () => {
    expect(resolveWritingTaskNumber("Bài luyện thêm", 7)).toBeNull();
    expect(resolveWritingTaskNumber(null, null)).toBeNull();
  });
});
