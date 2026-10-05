import { describe, expect, it } from "vitest";
import { aiSuggestionForReview } from "@/lib/ai-grading/review-fill";
import type { AiGradingResult } from "@/lib/ai-grading/types";

describe("aiSuggestionForReview", () => {
  it("Writing 2 task: điểm theo unitId, nhận xét có nhãn task", () => {
    const result: AiGradingResult = {
      version: 1,
      skill: "writing",
      tasks: [
        {
          unitId: "u1", label: "Writing Task 1", taskNumber: 1, summary: "Tốt.", errors: [],
          criteria: [
            { key: "taskAchievement", band: 6, reason: "Đủ ý." },
            { key: "coherence", band: 6.5, reason: "" },
            { key: "lexicalResource", band: 6, reason: "" },
            { key: "grammar", band: 5.5, reason: "" }
          ]
        },
        {
          unitId: "u2", label: "Writing Task 2", taskNumber: 2, summary: "Khá.", errors: [],
          criteria: [
            { key: "taskAchievement", band: 7, reason: "" },
            { key: "coherence", band: 7, reason: "" },
            { key: "lexicalResource", band: 6.5, reason: "" },
            { key: "grammar", band: 6, reason: "" }
          ]
        }
      ]
    };
    const suggestion = aiSuggestionForReview(result);
    expect(suggestion.scores.u1).toEqual({ taskAchievement: "6", coherence: "6.5", lexicalResource: "6", grammar: "5.5" });
    expect(suggestion.scores.u2.lexicalResource).toBe("6.5");
    expect(suggestion.summary).toBe("Writing Task 1: Tốt.\n\nWriting Task 2: Khá.");
    expect(suggestion.detailed).toContain("Đủ ý.");
  });

  it("Speaking: key rỗng, bỏ Pronunciation, kèm danh sách lỗi trong nhận xét chi tiết", () => {
    const result: AiGradingResult = {
      version: 1,
      skill: "speaking",
      tasks: [
        {
          unitId: "", label: "Speaking", taskNumber: null, summary: "Nói trôi.",
          criteria: [
            { key: "fluency", band: 6, reason: "" },
            { key: "lexicalResource", band: 6, reason: "" },
            { key: "grammar", band: 6, reason: "" },
            { key: "pronunciation", band: null, reason: "" }
          ],
          errors: [
            { id: "0-0", answerId: "a", quote: "I goes", correction: "I go", explanation: "Ngôi thứ nhất.", category: "grammar" }
          ]
        }
      ]
    };
    const suggestion = aiSuggestionForReview(result);
    expect(suggestion.scores[""]).toEqual({ fluency: "6", lexicalResource: "6", grammar: "6" });
    expect(suggestion.summary).toBe("Nói trôi.");
    expect(suggestion.detailed).toContain("• \"I goes\" → \"I go\": Ngôi thứ nhất.");
  });
});
