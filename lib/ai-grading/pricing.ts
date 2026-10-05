import type { ModelUsage } from "@/lib/ai-grading/types";

// USD cho mỗi 1 triệu token (bảng giá OpenAI tra ngày 5/10/2026).
export type ModelPrice = { input: number; cachedInput: number; output: number };

export const MODEL_PRICES: Record<string, ModelPrice> = {
  "gpt-6.1-sol": { input: 2, cachedInput: 0.1, output: 10 },
  "gpt-6-astra": { input: 10, cachedInput: 1, output: 50 },
  "gpt-6-luna": { input: 0.1, cachedInput: 0.01, output: 0.5 }
};

// Tỉ giá ước tính — chỉ để hiện "khoảng X đ" cho thầy theo dõi.
export const USD_TO_VND = 26_000;

export function costUsd(model: string, usage: ModelUsage): number | null {
  // OpenAI có thể trả tên kèm đuôi phiên bản (vd "gpt-6.1-sol-2026-09-01").
  const price =
    MODEL_PRICES[model] ??
    Object.entries(MODEL_PRICES).find(([name]) => model.startsWith(`${name}-`))?.[1];
  if (!price) return null;

  const cached = Math.min(usage.cachedInputTokens, usage.inputTokens);
  const uncached = usage.inputTokens - cached;

  return (uncached * price.input + cached * price.cachedInput + usage.outputTokens * price.output) / 1_000_000;
}

export function sumUsage(list: ModelUsage[]): ModelUsage {
  return list.reduce(
    (total, usage) => ({
      inputTokens: total.inputTokens + usage.inputTokens,
      cachedInputTokens: total.cachedInputTokens + usage.cachedInputTokens,
      outputTokens: total.outputTokens + usage.outputTokens
    }),
    { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 }
  );
}

// Viết số kiểu Việt Nam (1.200đ) bằng tay — không phụ thuộc ICU của Node.
export function formatVnd(usd: number): string {
  const vnd = Math.round((usd * USD_TO_VND) / 100) * 100;
  return `${String(vnd).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}đ`;
}
