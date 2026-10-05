import { describe, expect, it } from "vitest";
import {
  AiOutputError,
  aiOverallBand,
  aiTaskBand,
  isValidBand,
  parseAiGradingResult,
  validateTaskOutput
} from "@/lib/ai-grading/validate";
import { modelOutputJsonSchema } from "@/lib/ai-grading/schema";
import { toAiReviewView } from "@/lib/ai-grading/views";
import type { AiGradingResult, GradingTaskInput } from "@/lib/ai-grading/types";

const task: GradingTaskInput = {
  unitId: "u2",
  label: "Writing Task 2",
  taskNumber: 2,
  prompt: "Discuss.",
  images: [],
  minWords: 250,
  answers: [
    { answerId: "ans1", ref: "A1", questionPrompt: null, text: "Many people believes that technology are useful." }
  ]
};

function good() {
  return {
    criteria: [
      { key: "taskAchievement", band: 6, reason: "Trả lời đủ ý." },
      { key: "coherence", band: 6.5, reason: "Mạch lạc." },
      { key: "lexicalResource", band: 6, reason: "Từ vựng đủ dùng." },
      { key: "grammar", band: 5.5, reason: "Nhiều lỗi chia động từ." }
    ],
    summary: "Bài ổn, cần sửa ngữ pháp.",
    errors: [
      { answer_ref: "A1", quote: "people believes", correction: "people believe", explanation: "Chủ ngữ số nhiều.", category: "grammar" },
      { answer_ref: "A1", quote: "this sentence was never written", correction: "x", explanation: "y", category: "grammar" },
      { answer_ref: "A1", quote: "technology are", correction: "technology is", explanation: "Danh từ không đếm được.", category: "lạ" }
    ]
  };
}

describe("validateTaskOutput", () => {
  it("giữ lỗi có thật, bỏ lỗi bịa, gán id ổn định, loại lạ thành grammar", () => {
    const result = validateTaskOutput(good(), task, "writing", 0);
    expect(result.unitId).toBe("u2");
    expect(result.criteria.map((c) => c.band)).toEqual([6, 6.5, 6, 5.5]);
    expect(result.errors.map((e) => e.quote)).toEqual(["people believes", "technology are"]);
    expect(result.errors.map((e) => e.id)).toEqual(["0-0", "0-1"]);
    expect(result.errors[0].answerId).toBe("ans1");
    expect(result.errors[1].category).toBe("grammar");
  });

  it("band không phải bội số 0,5 → lỗi cả lượt", () => {
    const raw = good();
    raw.criteria[0].band = 6.3;
    expect(() => validateTaskOutput(raw, task, "writing", 0)).toThrow(AiOutputError);
  });

  it("thiếu tiêu chí hoặc tiêu chí lạ → lỗi", () => {
    const missing = good();
    missing.criteria.pop();
    expect(() => validateTaskOutput(missing, task, "writing", 0)).toThrow(AiOutputError);

    const unknown = good();
    unknown.criteria[0].key = "pronunciation";
    expect(() => validateTaskOutput(unknown, task, "writing", 0)).toThrow(AiOutputError);
  });

  it("Speaking thêm Pronunciation = null", () => {
    const speakingTask = { ...task, unitId: "", taskNumber: null };
    const raw = {
      criteria: [
        { key: "fluency", band: 6, reason: "a" },
        { key: "lexicalResource", band: 6, reason: "b" },
        { key: "grammar", band: 6.5, reason: "c" }
      ],
      summary: "ok",
      errors: []
    };
    const result = validateTaskOutput(raw, speakingTask, "speaking", 0);
    expect(result.criteria.at(-1)).toMatchObject({ key: "pronunciation", band: null });
    expect(aiTaskBand(result)).toBe(6);
  });

  it("isValidBand", () => {
    expect(isValidBand(0)).toBe(true);
    expect(isValidBand(9)).toBe(true);
    expect(isValidBand(7.5)).toBe(true);
    expect(isValidBand(9.5)).toBe(false);
    expect(isValidBand(-0.5)).toBe(false);
    expect(isValidBand("6")).toBe(false);
  });
});

describe("band AI", () => {
  function writingTask(unitId: string, taskNumber: 1 | 2, band: number) {
    return {
      unitId,
      label: `Task ${taskNumber}`,
      taskNumber,
      criteria: ["taskAchievement", "coherence", "lexicalResource", "grammar"].map((key) => ({ key, band, reason: "" })),
      summary: "",
      errors: []
    };
  }

  it("Writing nhân trọng số Task 1 : Task 2 = 1 : 2", () => {
    const result: AiGradingResult = { version: 1, skill: "writing", tasks: [writingTask("u1", 1, 6), writingTask("u2", 2, 7)] };
    expect(aiOverallBand(result)).toBe(6.5);
  });

  it("parseAiGradingResult chịu dữ liệu hỏng", () => {
    expect(parseAiGradingResult(null)).toBeNull();
    expect(parseAiGradingResult("{oops")).toBeNull();
    expect(parseAiGradingResult(JSON.stringify({ version: 2, tasks: [] }))).toBeNull();
    const ok: AiGradingResult = { version: 1, skill: "writing", tasks: [writingTask("u1", 1, 6)] };
    expect(parseAiGradingResult(JSON.stringify(ok))).toEqual(ok);
  });
});

describe("JSON schema", () => {
  it("Writing liệt kê 4 key, Speaking 3 key (không Pronunciation); strict-ready", () => {
    const writing = JSON.stringify(modelOutputJsonSchema("writing"));
    const speaking = JSON.stringify(modelOutputJsonSchema("speaking"));
    expect(writing).toContain('"taskAchievement"');
    expect(speaking).toContain('"fluency"');
    expect(speaking).not.toContain('"pronunciation"');
    expect(writing).toContain('"additionalProperties":false');
  });
});

describe("toAiReviewView", () => {
  it("pending quá 5 phút hiện thành failed", () => {
    const now = new Date("2026-10-05T10:00:00Z");
    const view = toAiReviewView(
      { id: "r", status: "pending", requestedBy: "teacher", errorMessage: null, resultJson: null, createdAt: new Date("2026-10-05T09:50:00Z") },
      now
    );
    expect(view.status).toBe("failed");
    expect(view.errorMessage).toContain("gián đoạn");
  });
});
