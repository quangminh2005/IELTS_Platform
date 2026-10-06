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
import { parseSpeechTiming, serializeSpeechTiming, type TimedWord } from "@/lib/speech-fluency";
import { isAudioUrl } from "@/lib/question-interactions";

const FAKE_TRANSCRIPT = "Well, I think I goes to school by bus every day because it is more cheaper.";

// Mốc giả cho FAKE_TRANSCRIPT: có một chỗ ngừng 1,6 giây giữa cụm từ để kiểm luồng.
function fakeWords(): TimedWord[] {
  let at = 0.3;
  return FAKE_TRANSCRIPT.split(" ").map((w, index) => {
    if (index === 4) at += 1.6;
    const word = { w, s: Math.round(at * 100) / 100, e: Math.round((at + 0.3) * 100) / 100 };
    at += 0.35;
    return word;
  });
}

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

// Speaking: câu nào chưa có bản phiên âm KÈM mốc thời gian thì phiên âm bằng Groq rồi
// lưu cả hai cột (thầy cũng thấy ở trang chấm). Bài cũ có chữ mà chưa có mốc → phiên âm
// lại một lần để đo độ trôi chảy; lần đó lỗi thì vẫn chấm bằng chữ cũ. Bản ghi RỖNG
// (file 0 byte do tải lên hỏng) thì bỏ qua câu đó; lỗi khác khi chưa có chữ → lỗi cả lượt.
async function ensureSpeakingTranscripts(rows: AnswerRow[]): Promise<void> {
  for (const row of rows) {
    if (row.assignableUnit.skill !== "speaking") continue;
    if (!row.value || !isAudioUrl(row.value)) continue;
    const hasText = Boolean(row.transcript?.trim());
    if (hasText && parseSpeechTiming(row.speechTimingJson)) continue;

    const result = isFakeGrading()
      ? { ok: true as const, transcript: FAKE_TRANSCRIPT, words: fakeWords() }
      : await transcribeAudioUrl(row.value);

    if (!result.ok) {
      if (result.reason === "empty" || hasText) continue;
      throw new AiCallError(`Không phiên âm được bản ghi: ${result.error}`);
    }

    const timing = result.words.length > 0 ? serializeSpeechTiming(result.words) : null;
    row.transcript = result.transcript;
    row.speechTimingJson = timing;
    await prisma.answer.update({
      where: { id: row.id },
      data: { transcript: result.transcript, speechTimingJson: timing }
    });
  }
}
