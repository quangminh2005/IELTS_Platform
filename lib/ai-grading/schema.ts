import { aiCriteriaKeys } from "@/lib/ai-grading/criteria";
import { AI_ERROR_CATEGORIES, type AiSkill } from "@/lib/ai-grading/types";

// Khuôn JSON model PHẢI trả về (OpenAI Structured Outputs, strict). Strict mode đòi
// mọi thuộc tính đều "required" và additionalProperties: false ở mọi tầng.
export function modelOutputJsonSchema(skill: AiSkill): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["criteria", "summary", "errors"],
    properties: {
      criteria: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "band", "reason"],
          properties: {
            key: { type: "string", enum: aiCriteriaKeys(skill) },
            band: { type: "number" },
            reason: { type: "string" }
          }
        }
      },
      summary: { type: "string" },
      errors: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["answer_ref", "quote", "correction", "explanation", "category"],
          properties: {
            answer_ref: { type: "string" },
            quote: { type: "string" },
            correction: { type: "string" },
            explanation: { type: "string" },
            category: { type: "string", enum: [...AI_ERROR_CATEGORIES] }
          }
        }
      }
    }
  };
}
