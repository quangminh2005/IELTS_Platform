"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useRef, useState } from "react";

type AudioRecorderAnswerProps = {
  questionId: string;
  initialValue: string;
  onAnswerChange: (questionId: string, value: string) => void;
};

// Chọn định dạng ghi âm trình duyệt hỗ trợ (Chrome: webm/opus; Safari: mp4).
function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }
  const candidates = ["audio/webm", "audio/mp4", "audio/ogg"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function AudioRecorderAnswer({
  questionId,
  initialValue,
  onAnswerChange
}: AudioRecorderAnswerProps) {
  const [url, setUrl] = useState(initialValue);
  const [status, setStatus] = useState<"idle" | "recording" | "uploading" | "error">("idle");
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  function stopTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    return () => {
      stopTimer();
      stopTracks();
    };
  }, []);

  async function startRecording() {
    setMessage("");
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setMessage("Trình duyệt không hỗ trợ ghi âm. Hãy dùng Chrome/Edge/Safari mới nhất.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopTracks();
        const type = mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        void uploadRecording(blob, type);
      };

      recorder.start();
      recorderRef.current = recorder;
      setStatus("recording");
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((prev) => prev + 1), 1000);
    } catch {
      setStatus("error");
      setMessage("Không truy cập được micro. Hãy cho phép quyền micro rồi thử lại.");
      stopTracks();
    }
  }

  function stopRecording() {
    stopTimer();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      setStatus("uploading");
      setMessage("Đang tải bản ghi lên…");
    }
  }

  async function uploadRecording(blob: Blob, type: string) {
    try {
      const ext = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : "webm";
      const fileName = `speaking-${questionId}-${Date.now()}.${ext}`;
      // Đặt lại type gọn (bỏ ";codecs=…") để khớp allowedContentTypes.
      const cleanType = type.split(";")[0] || "audio/webm";
      const file = new File([blob], fileName, { type: cleanType });

      const result = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/speaking/upload",
        contentType: cleanType
      });

      setUrl(result.url);
      onAnswerChange(questionId, result.url);
      setStatus("idle");
      setMessage("Đã nộp bản ghi.");
    } catch (error) {
      setStatus("error");
      setMessage(`Lỗi tải lên: ${(error as Error).message}`);
    }
  }

  function clearRecording() {
    setUrl("");
    onAnswerChange(questionId, "");
    setMessage("");
    setStatus("idle");
  }

  return (
    <div className="mt-3 space-y-3">
      <input type="hidden" name={`q_${questionId}`} value={url} />

      {url ? (
        <div className="space-y-2">
          <audio controls src={url} className="w-full">
            <track kind="captions" />
          </audio>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={clearRecording}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-foreground"
            >
              Ghi âm lại
            </button>
            <span className="text-xs text-emerald-600 dark:text-emerald-300">
              Đã lưu bản ghi ✓
            </span>
          </div>
        </div>
      ) : status === "recording" ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            <span className="h-2.5 w-2.5 rounded-sm bg-white" /> Dừng &amp; nộp
          </button>
          <span className="inline-flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-300">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
            Đang ghi… {formatTime(seconds)}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={startRecording}
            disabled={status === "uploading"}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-white" />
            {status === "uploading" ? "Đang tải lên…" : "Bắt đầu ghi âm"}
          </button>
        </div>
      )}

      {message ? (
        <p
          className={
            status === "error"
              ? "text-xs text-red-600 dark:text-red-300"
              : "text-xs text-muted-foreground"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
