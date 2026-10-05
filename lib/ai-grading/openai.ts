// NƠI DUY NHẤT gọi OpenAI (tests/ai-grading-guard.test.ts ép). Đổi nhà cung cấp/model
// chỉ sửa file này + bảng giá lib/ai-grading/pricing.ts.
import OpenAI from "openai";
import type { ModelInput } from "@/lib/ai-grading/prompt";
import { modelOutputJsonSchema } from "@/lib/ai-grading/schema";
import type { AiSkill, ModelUsage } from "@/lib/ai-grading/types";

export const DEFAULT_GRADING_MODEL = "gpt-6.1-sol";

export function gradingModel(): string {
  return process.env.OPENAI_GRADING_MODEL?.trim() || DEFAULT_GRADING_MODEL;
}

// Chế độ giả cho local: không gọi mạng, không tốn tiền, trả kết quả cố định.
export function isFakeGrading(): boolean {
  return process.env.AI_GRADING_FAKE === "1";
}

export function isAiGradingEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim()) || isFakeGrading();
}

// Lỗi khi gọi model — thông điệp tiếng Việt hiện thẳng cho người dùng.
export class AiCallError extends Error {}

export type ModelCallResult = { output: unknown; usage: ModelUsage; model: string };

let client: OpenAI | null = null;
function getClient(): OpenAI {
  client ??= new OpenAI({ timeout: 120_000, maxRetries: 1 });
  return client;
}

function describeOpenAiError(error: unknown): string {
  if (error instanceof OpenAI.AuthenticationError) return "Khoá OPENAI_API_KEY không hợp lệ.";
  if (error instanceof OpenAI.RateLimitError) {
    return "OpenAI đang giới hạn lượt gọi hoặc tài khoản đã hết tiền. Thử lại sau.";
  }
  if (error instanceof OpenAI.APIConnectionTimeoutError) return "OpenAI trả lời quá lâu. Thử lại sau.";
  if (error instanceof OpenAI.APIError) {
    return `Lỗi OpenAI (${error.status ?? "?"}): ${error.message.slice(0, 200)}`;
  }
  return `Lỗi gọi OpenAI: ${error instanceof Error ? error.message : "không rõ"}`;
}

export async function callGradingModel(input: ModelInput, skill: AiSkill): Promise<ModelCallResult> {
  if (isFakeGrading()) {
    return fakeResult(input, skill);
  }

  const model = gradingModel();
  let response;
  try {
    response = await getClient().responses.create({
      model,
      reasoning: { effort: "medium" },
      input: [
        { role: "system", content: input.system },
        {
          role: "user",
          content: input.userParts.map((part) =>
            part.type === "text"
              ? { type: "input_text" as const, text: part.text }
              : { type: "input_image" as const, image_url: part.url, detail: "high" as const }
          )
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ielts_grading",
          strict: true,
          schema: modelOutputJsonSchema(skill)
        }
      }
    });
  } catch (error) {
    throw new AiCallError(describeOpenAiError(error));
  }

  if (response.status === "incomplete") {
    throw new AiCallError("AI trả lời bị cắt ngang giữa chừng. Thử lại sau.");
  }

  const refused = response.output.some(
    (item) => item.type === "message" && item.content.some((part) => part.type === "refusal")
  );
  if (refused) {
    throw new AiCallError("AI từ chối chấm bài này.");
  }

  let output: unknown;
  try {
    output = JSON.parse(response.output_text);
  } catch {
    throw new AiCallError("AI trả về dữ liệu hỏng (không phải JSON).");
  }

  return {
    output,
    model: response.model || model,
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0
    }
  };
}

// ---- Chế độ giả ----

async function fakeResult(input: ModelInput, skill: AiSkill): Promise<ModelCallResult> {
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const text = input.userParts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n");
  const firstResponse = /<response ref="(A\d+)">\n([\s\S]*?)\n<\/response>/.exec(text);
  const ref = firstResponse?.[1] ?? "A1";
  const realQuote = (firstResponse?.[2] ?? "").split(/\s+/).filter(Boolean).slice(0, 3).join(" ");

  const keys =
    skill === "speaking"
      ? ["fluency", "lexicalResource", "grammar"]
      : ["taskAchievement", "coherence", "lexicalResource", "grammar"];

  return {
    model: "fake",
    usage: { inputTokens: 5000, cachedInputTokens: 3000, outputTokens: 2000 },
    output: {
      criteria: keys.map((key, index) => ({
        key,
        band: index % 2 === 0 ? 6 : 6.5,
        reason: `(Chế độ giả) Lý do cho tiêu chí ${key}.`
      })),
      summary: "(Chế độ giả) Bài làm có ý rõ ràng nhưng còn lỗi ngữ pháp cơ bản.",
      errors: [
        ...(realQuote
          ? [
              {
                answer_ref: ref,
                quote: realQuote,
                correction: "(sửa giả)",
                explanation: "(Chế độ giả) Lỗi có thật trong bài.",
                category: "grammar"
              }
            ]
          : []),
        {
          answer_ref: ref,
          quote: "câu này không có trong bài",
          correction: "x",
          explanation: "Lỗi bịa — phải bị lọc.",
          category: "vocabulary"
        }
      ]
    }
  };
}
