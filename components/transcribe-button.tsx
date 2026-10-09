"use client";

import { useState, useTransition } from "react";
import { transcribeAnswer } from "@/lib/actions/transcribe";
import { formatFluencyLine, type FluencyStats } from "@/lib/speech-fluency";
import { isLikelyHallucination } from "@/lib/transcript-hallucination";

type TranscribeButtonProps = {
  answerId: string;
  initialTranscript: string | null;
  // Số đo độ trôi chảy đo từ audio (chỉ trang chấm của thầy dùng nút này).
  initialFluency: FluencyStats | null;
};

export function TranscribeButton({ answerId, initialTranscript, initialFluency }: TranscribeButtonProps) {
  const [transcript, setTranscript] = useState(initialTranscript ?? "");
  const [fluency, setFluency] = useState(initialFluency);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function run() {
    setError("");
    startTransition(async () => {
      const result = await transcribeAnswer(answerId);
      if (result.ok) {
        setTranscript(result.transcript);
        setFluency(result.fluency);
      } else {
        setError(result.error);
        if (result.cleared) {
          setTranscript("");
          setFluency(null);
        }
      }
    });
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-semibold transition hover:border-primary disabled:opacity-50"
      >
        {pending ? "Đang phiên âm…" : transcript ? "Phiên âm lại" : "Phiên âm (chuyển thành văn bản)"}
      </button>

      {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p> : null}

      {transcript ? (
        <div className="mt-2 rounded-md border border-border bg-muted/40 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Bản phiên âm (tự động — có thể có lỗi)
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{transcript}</p>
          {isLikelyHallucination(transcript) ? (
            <p className="mt-2 rounded-md border border-amber-400/60 bg-amber-400/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
              Bản phiên âm này có vẻ do máy bịa ra (bản ghi im lặng hoặc quá nhỏ) — thầy nghe lại audio. AI
              chấm sẽ bỏ qua câu này.
            </p>
          ) : null}
          {fluency ? (
            <p className="mt-2 text-xs text-muted-foreground">{formatFluencyLine(fluency)}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
