"use client";

import { upload } from "@vercel/blob/client";
import { type ChangeEvent, useEffect, useRef, useState } from "react";

import {
  type SpeakingSource,
  checkSpeakingFile,
  speakingUploadName
} from "@/lib/speaking-upload";

// Trạng thái "bận": bản ghi chưa nằm an toàn trên server. Màn làm bài dùng cờ
// này để chặn nộp bài — bấm Nộp lúc này là mất trắng bản ghi.
export type RecorderBusy = "recording" | "uploading";

type AudioRecorderAnswerProps = {
  questionId: string;
  initialValue: string;
  onAnswerChange: (questionId: string, value: string) => void;
  onBusyChange?: (questionId: string, busy: RecorderBusy | null) => void;
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
  onAnswerChange,
  onBusyChange
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

  // Báo cờ bận ra ngoài mỗi khi đổi trạng thái. "error" KHÔNG tính là bận: upload
  // hỏng thì phải cho học viên nộp, không được nhốt trong phòng thi.
  useEffect(() => {
    onBusyChange?.(
      questionId,
      status === "recording" ? "recording" : status === "uploading" ? "uploading" : null
    );
  }, [status, questionId, onBusyChange]);

  // Ô ghi âm bị tháo khỏi màn hình (đổi kỹ năng, thoát phòng thi) thì gỡ cờ,
  // không thì màn làm bài kẹt trạng thái bận vĩnh viễn và không nộp được nữa.
  useEffect(() => {
    return () => onBusyChange?.(questionId, null);
  }, [questionId, onBusyChange]);

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
        // Bỏ ";codecs=…" để khớp allowedContentTypes của route.
        const type = (mimeType || "audio/webm").split(";")[0];
        const blob = new Blob(chunksRef.current, { type });
        void uploadRecording(blob, type, "recorded");
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

  // Một đường tải lên duy nhất cho cả bản ghi trực tiếp lẫn file học viên chọn từ
  // máy — nhờ vậy cờ bận (chặn nộp bài) bảo vệ cả hai như nhau.
  async function uploadRecording(body: Blob, contentType: string, source: SpeakingSource) {
    const label = source === "uploaded" ? "Đang tải file lên" : "Đang tải bản ghi lên";
    setStatus("uploading");
    setMessage(`${label}… 0%`);

    try {
      const result = await upload(speakingUploadName(questionId, source, contentType), body, {
        access: "public",
        handleUploadUrl: "/api/speaking/upload",
        contentType,
        onUploadProgress: ({ percentage }) => {
          // File thu từ điện thoại thường nặng hơn bản ghi trên web — không có %
          // thì học viên tưởng máy treo rồi bỏ đi.
          setMessage(`${label}… ${Math.round(percentage)}%`);
        }
      });

      setUrl(result.url);
      onAnswerChange(questionId, result.url);
      setStatus("idle");
      setMessage(source === "uploaded" ? "Đã nộp file ghi âm." : "Đã nộp bản ghi.");
    } catch (error) {
      setStatus("error");
      setMessage(`Lỗi tải lên: ${(error as Error).message}. Em thử lại giúp cô nhé.`);
    }
  }

  function handleFilePick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Xoá value ngay: không thì chọn lại ĐÚNG file đó lần hai sẽ không kích hoạt
    // onChange, học viên bấm mãi mà không thấy gì xảy ra.
    event.target.value = "";

    if (!file) {
      return;
    }

    const check = checkSpeakingFile(file);

    if (!check.ok) {
      setStatus("error");
      setMessage(check.message);
      return;
    }

    void uploadRecording(file, check.contentType, "uploaded");
  }

  function clearRecording() {
    setUrl("");
    onAnswerChange(questionId, "");
    setMessage("");
    setStatus("idle");
  }

  // Nút chọn file: <label> bọc input ẩn, vì input file trần trụi mỗi trình duyệt
  // hiển thị một kiểu và không tô được theo giao diện phòng thi.
  const filePicker = (label: string, small: boolean) => (
    <label
      className={
        small
          ? "cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-foreground"
          : "inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary"
      }
    >
      {small ? null : <span aria-hidden="true">⬆</span>}
      {label}
      <input
        type="file"
        accept="audio/*,.m4a,.mp3,.wav,.ogg,.webm"
        onChange={handleFilePick}
        disabled={status === "uploading"}
        className="sr-only"
      />
    </label>
  );

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
            {filePicker("Tải file khác", true)}
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
          {/* Đường thứ hai: micro bị chặn hay trình duyệt cũ không ghi được thì
              học viên vẫn nộp được bằng file thu sẵn trên điện thoại. */}
          <span className="text-xs text-muted-foreground">hoặc</span>
          {filePicker("Tải file ghi âm lên", false)}
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
