"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { saveSpeakingPlan, startSpeakingPlan } from "@/lib/actions/speaking-plan";
import { SPEAKING_PLAN_MAX_LENGTH, formatPlanClock } from "@/lib/speaking-plan";

// Trạng thái dàn ý đọc từ DB lúc dựng trang (server tính sẵn số giây còn lại để
// không lệ thuộc đồng hồ máy học viên).
export type InitialSpeakingPlan = {
  text: string;
  locked: boolean;
  remainingSeconds: number;
};

type Phase = "idle" | "starting" | "planning" | "locked" | "bypass";

// Tự lưu nháp dàn ý mỗi chừng này mili-giây khi có thay đổi.
const AUTOSAVE_MS = 3000;

// Ô lập dàn ý + đồng hồ chuẩn bị cho MỘT câu Nói. Phần ghi âm (children) chỉ hiện
// khi đã hết giờ chuẩn bị hoặc học viên bấm "Xong, nói luôn" — giống thi thật.
export function SpeakingPlanBox({
  attemptId,
  questionId,
  prepMinutes,
  initialPlan,
  hasRecording,
  previewMode = false,
  onPlanChange,
  children
}: {
  attemptId: string;
  questionId: string;
  prepMinutes: number;
  initialPlan: InitialSpeakingPlan | null;
  // Câu đã có bản ghi từ trước (vd GV bật tuỳ chọn sau khi học viên đã ghi): không chặn.
  hasRecording: boolean;
  previewMode?: boolean;
  // Báo trạng thái ra màn làm bài để giữ lại khi ô bị dựng lại (đổi part/bước).
  onPlanChange?: (questionId: string, plan: InitialSpeakingPlan) => void;
  children: ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>(() => {
    if (!initialPlan) {
      return hasRecording ? "bypass" : "idle";
    }
    return initialPlan.locked || initialPlan.remainingSeconds <= 0 ? "locked" : "planning";
  });
  const [text, setText] = useState(initialPlan?.text ?? "");
  const [remaining, setRemaining] = useState(initialPlan?.remainingSeconds ?? prepMinutes * 60);
  const [message, setMessage] = useState("");
  const [confirmingDone, setConfirmingDone] = useState(false);

  // Mốc hết giờ theo đồng hồ máy này = lúc nhận số giây còn lại + số giây đó.
  const deadlineRef = useRef<number>(Date.now() + (initialPlan?.remainingSeconds ?? 0) * 1000);
  const textRef = useRef(text);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const lockingRef = useRef(false);

  const applyRemaining = useCallback((seconds: number) => {
    deadlineRef.current = Date.now() + seconds * 1000;
    setRemaining(seconds);
  }, []);

  // Lưu lên server. Chữ gửi đi luôn là bản mới nhất trong ref.
  const persist = useCallback(
    async (lock: boolean) => {
      if (previewMode) {
        return;
      }
      savingRef.current = true;
      dirtyRef.current = false;
      try {
        const result = await saveSpeakingPlan({
          attemptId,
          questionId,
          text: textRef.current,
          lock
        });
        if (!result.ok) {
          setMessage(result.message);
          dirtyRef.current = true;
        } else if (result.locked) {
          // Server báo đã hết giờ (vd máy học viên chạy chậm giờ): khoá theo server.
          setPhase("locked");
        }
      } catch {
        dirtyRef.current = true;
        setMessage("Mất kết nối — dàn ý sẽ được lưu lại khi có mạng.");
      } finally {
        savingRef.current = false;
      }
    },
    [attemptId, questionId, previewMode]
  );

  const lockNow = useCallback(async () => {
    if (lockingRef.current) {
      return;
    }
    lockingRef.current = true;
    setConfirmingDone(false);
    setPhase("locked");
    setRemaining(0);
    await persist(true);
  }, [persist]);

  useEffect(() => {
    if (phase !== "planning" && phase !== "locked") {
      return;
    }
    onPlanChange?.(questionId, {
      text,
      locked: phase === "locked",
      remainingSeconds:
        phase === "locked" ? 0 : Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000))
    });
  }, [phase, text, questionId, onPlanChange]);

  // Đang chuẩn bị mà trang vừa dựng lại (tải lại/quay lại): hỏi server số giây còn
  // lại mới nhất — số giây in sẵn trong trang có thể đã cũ nếu trang được lưu đệm.
  useEffect(() => {
    if (phase !== "planning" || previewMode) {
      return;
    }
    let cancelled = false;
    startSpeakingPlan({ attemptId, questionId })
      .then((result) => {
        if (cancelled || !result.ok) return;
        if (result.locked) {
          setPhase("locked");
          setRemaining(0);
        } else {
          applyRemaining(result.remainingSeconds);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // Chỉ chạy lúc mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nhịp đồng hồ + tự lưu khi đang chuẩn bị.
  useEffect(() => {
    if (phase !== "planning") {
      return;
    }
    const tick = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        void lockNow();
      }
    }, 250);
    const autosave = window.setInterval(() => {
      if (dirtyRef.current && !savingRef.current) {
        void persist(false);
      }
    }, AUTOSAVE_MS);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(autosave);
    };
  }, [phase, lockNow, persist]);

  async function handleStart() {
    setMessage("");
    if (previewMode) {
      applyRemaining(prepMinutes * 60);
      setPhase("planning");
      return;
    }
    setPhase("starting");
    try {
      const result = await startSpeakingPlan({ attemptId, questionId });
      if (!result.ok) {
        setMessage(result.message);
        setPhase("idle");
        return;
      }
      setText(result.text);
      textRef.current = result.text;
      if (result.locked) {
        setPhase("locked");
        setRemaining(0);
      } else {
        applyRemaining(result.remainingSeconds);
        setPhase("planning");
      }
    } catch {
      setMessage("Không bắt đầu được — em kiểm tra mạng rồi bấm lại nhé.");
      setPhase("idle");
    }
  }

  if (phase === "bypass") {
    return <>{children}</>;
  }

  if (phase === "idle" || phase === "starting") {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-primary/50 bg-primary/5 p-4">
        <p className="text-sm font-medium">
          Em có {prepMinutes} phút để lập dàn ý trước khi nói.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Bấm bắt đầu thì đồng hồ chạy luôn (tải lại trang cũng không dừng). Hết giờ, ô dàn ý
          sẽ khoá lại và em chuyển sang ghi âm. Cô sẽ xem dàn ý của em khi chấm bài.
        </p>
        <button
          type="button"
          onClick={handleStart}
          disabled={phase === "starting"}
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {phase === "starting" ? "Đang bắt đầu…" : `Bắt đầu chuẩn bị (${prepMinutes} phút)`}
        </button>
        {message ? <p className="mt-2 text-xs text-red-600 dark:text-red-300">{message}</p> : null}
      </div>
    );
  }

  const planning = phase === "planning";
  const urgent = planning && remaining <= 10;

  return (
    <div className="mt-3 space-y-3">
      <div
        className={
          planning
            ? "rounded-lg border-2 border-primary/60 bg-background p-3"
            : "rounded-lg border border-border bg-muted/40 p-3"
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            {planning ? "Dàn ý của em" : "Dàn ý của em (đã khoá)"}
          </p>
          {planning ? (
            <span
              role="timer"
              aria-label={`Còn ${formatPlanClock(remaining)} để chuẩn bị`}
              className={[
                "rounded-md border-2 px-2.5 py-0.5 text-lg font-extrabold tabular-nums",
                urgent
                  ? "animate-pulse border-red-500/70 bg-red-500/15 text-red-600 dark:text-red-300"
                  : "border-primary/50 bg-primary/10 text-primary"
              ].join(" ")}
            >
              {formatPlanClock(remaining)}
            </span>
          ) : null}
        </div>
        {planning ? (
          <textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              textRef.current = event.target.value;
              dirtyRef.current = true;
            }}
            maxLength={SPEAKING_PLAN_MAX_LENGTH}
            rows={6}
            autoFocus
            placeholder="Ghi nhanh ý chính, từ khoá, ví dụ… (không cần viết thành câu hoàn chỉnh)"
            className="mt-2 w-full resize-y rounded-md border border-border bg-background/60 px-3 py-2 text-sm leading-6 outline-none focus:border-primary"
          />
        ) : text.trim() ? (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{text}</p>
        ) : (
          <p className="mt-2 text-sm italic text-muted-foreground">Em không ghi dàn ý.</p>
        )}
        {planning ? (
          confirmingDone ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium">Khoá dàn ý và chuyển sang ghi âm?</span>
              <button
                type="button"
                onClick={() => void lockNow()}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Đồng ý
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDone(false)}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-foreground"
              >
                Viết tiếp
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDone(true)}
              className="mt-2 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-foreground"
            >
              Xong, nói luôn
            </button>
          )
        ) : null}
        {message ? <p className="mt-2 text-xs text-red-600 dark:text-red-300">{message}</p> : null}
      </div>

      {planning ? (
        <p className="text-xs text-muted-foreground">
          Phần ghi âm sẽ mở khi hết giờ chuẩn bị.
        </p>
      ) : (
        children
      )}
    </div>
  );
}
