"use client";

import { useState, useTransition } from "react";
import { transcribeAnswer } from "@/lib/actions/transcribe";

type TranscribeButtonProps = {
  answerId: string;
  initialTranscript: string | null;
};

export function TranscribeButton({ answerId, initialTranscript }: TranscribeButtonProps) {
  const [transcript, setTranscript] = useState(initialTranscript ?? "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function run() {
    setError("");
    startTransition(async () => {
      const result = await transcribeAnswer(answerId);
      if (result.ok) {
        setTranscript(result.transcript);
      } else {
        setError(result.error);
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
        </div>
      ) : null}
    </div>
  );
}
