// Điều phối một lượt AI chấm: chặn trùng → tạo dòng pending → (phiên âm Speaking) →
// gọi model từng task → kiểm kết quả → lưu done/failed. KHÔNG kiểm quyền — server
// action (lib/actions/ai-grading.ts) phải kiểm trước khi gọi.
import { ANSWER_ROW_SELECT, buildGradingInput, type AnswerRow } from "@/lib/ai-grading/input";
import { AiCallError, callGradingModel, gradingModel, isFakeGrading } from "@/lib/ai-grading/openai";
import { costUsd, sumUsage } from "@/lib/ai-grading/pricing";
import { buildGradingMessages } from "@/lib/ai-grading/prompt";
import { isStalePending } from "@/lib/ai-grading/quota";
import type { AiGradingResult, AiRequester } from "@/lib/ai-grading/types";
import { AiOutputError, validateTaskOutput } from "@/lib/ai-grading/validate";
import { transcribeAudioUrl } from "@/lib/groq-transcribe";
import { prisma } from "@/lib/prisma";
import { isAudioUrl } from "@/lib/question-interactions";

const FAKE_TRANSCRIPT = "Well, I think I goes to school by bus every day because it is more cheaper.";

export type RunAiGradingResult = { ok: true; reviewId: string } | { ok: false; message: string };

export async function runAiGrading(params: {
  attemptId: string;
  studentId: string;
  requestedBy: AiRequester;
}): Promise<RunAiGradingResult> {
  const now = new Date();

  const pending = await prisma.aiReview.findFirst({
    where: { attemptId: params.attemptId, status: "pending" },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true }
  });

  if (pending) {
    if (!isStalePending(pending.createdAt, now)) {
      return { ok: false, message: "Bài này đang được AI chấm, đợi một chút rồi tải lại trang." };
    }
    await prisma.aiReview.update({
      where: { id: pending.id },
      data: { status: "failed", errorMessage: "Lượt chấm bị gián đoạn, hãy thử lại." }
    });
  }

  const review = await prisma.aiReview.create({
    data: {
      attemptId: params.attemptId,
      studentId: params.studentId,
      requestedBy: params.requestedBy,
      status: "pending",
      model: gradingModel()
    },
    select: { id: true }
  });

  try {
    const rows: AnswerRow[] = await prisma.answer.findMany({
      where: {
        attemptId: params.attemptId,
        isCorrect: null,
        assignableUnit: { skill: { in: ["writing", "speaking"] } }
      },
      orderBy: { createdAt: "asc" },
      select: ANSWER_ROW_SELECT
    });

    await ensureSpeakingTranscripts(rows);

    const input = buildGradingInput(rows);
    if (!input) {
      throw new AiCallError("Bài làm trống, không có gì để AI chấm.");
    }

    const calls = await Promise.all(
      input.tasks.map((task) => callGradingModel(buildGradingMessages(input, task), input.skill))
    );
    const tasks = calls.map((call, index) =>
      validateTaskOutput(call.output, input.tasks[index], input.skill, index)
    );
    const usage = sumUsage(calls.map((call) => call.usage));
    const model = calls[0]?.model ?? gradingModel();
    const result: AiGradingResult = { version: 1, skill: input.skill, tasks };

    await prisma.aiReview.update({
      where: { id: review.id },
      data: {
        status: "done",
        model,
        resultJson: JSON.stringify(result),
        inputTokens: usage.inputTokens,
        cachedInputTokens: usage.cachedInputTokens,
        outputTokens: usage.outputTokens,
        costUsd: costUsd(model, usage)
      }
    });

    return { ok: true, reviewId: review.id };
  } catch (error) {
    const known = error instanceof AiCallError || error instanceof AiOutputError;
    if (!known) {
      console.error("[ai-grading] lỗi không lường trước:", error);
    }
    const message = known ? (error as Error).message : "Có lỗi không xác định khi AI chấm. Thử lại sau.";

    await prisma.aiReview
      .update({ where: { id: review.id }, data: { status: "failed", errorMessage: message } })
      .catch((updateError) => console.error("[ai-grading] không ghi được trạng thái lỗi:", updateError));

    return { ok: false, message };
  }
}

// Speaking: câu nào chưa có bản phiên âm thì phiên âm bằng Groq rồi lưu luôn vào
// Answer.transcript (thầy cũng thấy ở trang chấm). Lỗi một câu → lỗi cả lượt.
async function ensureSpeakingTranscripts(rows: AnswerRow[]): Promise<void> {
  for (const row of rows) {
    if (row.assignableUnit.skill !== "speaking") continue;
    if (row.transcript?.trim() || !row.value || !isAudioUrl(row.value)) continue;

    const result = isFakeGrading()
      ? { ok: true as const, transcript: FAKE_TRANSCRIPT }
      : await transcribeAudioUrl(row.value);

    if (!result.ok) {
      throw new AiCallError(`Không phiên âm được bản ghi: ${result.error}`);
    }

    row.transcript = result.transcript;
    await prisma.answer.update({ where: { id: row.id }, data: { transcript: result.transcript } });
  }
}
