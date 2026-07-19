"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Màn "Kiểm tra âm thanh" trước khi vào bài Listening ở chế độ thi thật (ẩn thanh
// audio). Học viên phát thử một đoạn chuông ngắn để chỉnh loa/tai nghe, sau đó bấm
// "Tiếp tục" — cú bấm này đồng thời là thao tác người dùng giúp trình duyệt cho
// phép audio bài nghe tự phát ngay sau đó.

const HeadphoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
    <path
      d="M4 13a8 8 0 1 1 16 0"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <rect x="3" y="13" width="4" height="7" rx="1.6" fill="currentColor" />
    <rect x="17" y="13" width="4" height="7" rx="1.6" fill="currentColor" />
  </svg>
);

type SoundCheckProps = {
  title: string;
  onContinue: () => void;
  onExit: () => void;
};

export function SoundCheck({ title, onContinue, onExit }: SoundCheckProps) {
  const [playing, setPlaying] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const stopTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (stopTimerRef.current != null) {
        window.clearTimeout(stopTimerRef.current);
      }
      void contextRef.current?.close().catch(() => undefined);
    };
  }, []);

  // Phát chuỗi nốt chuông (Web Audio) — không cần file audio riêng, không lộ đề.
  const playTestSound = useCallback(() => {
    type AudioContextConstructor = typeof AudioContext;
    const Ctor: AudioContextConstructor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!Ctor) return;

    if (!contextRef.current) {
      contextRef.current = new Ctor();
    }
    const context = contextRef.current;
    void context.resume().catch(() => undefined);

    const start = context.currentTime + 0.05;
    // Giai điệu ngắn C5–E5–G5–C6 rồi ngân lại C6, tổng ~2.6s.
    const notes = [523.25, 659.25, 783.99, 1046.5, 1046.5];
    notes.forEach((frequency, index) => {
      const at = start + index * 0.45;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.35, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.45);
    });

    setPlaying(true);
    if (stopTimerRef.current != null) {
      window.clearTimeout(stopTimerRef.current);
    }
    stopTimerRef.current = window.setTimeout(() => setPlaying(false), 2600);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-primary transition hover:border-primary"
        >
          ‹ Quay lại
        </button>
        <h2 className="min-w-0 truncate text-base font-bold tracking-tight sm:text-lg">{title}</h2>
        <span className="w-24" />
      </header>

      <div className="flex flex-1 items-start justify-center overflow-y-auto p-5">
        <div className="mt-10 w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="flex items-center gap-2.5 bg-slate-900 px-5 py-3.5 text-white dark:bg-slate-800">
            <HeadphoneIcon />
            <p className="text-base font-semibold">Kiểm tra âm thanh</p>
          </div>
          <div className="space-y-4 px-6 py-6 text-center">
            <p className="text-sm leading-6 text-foreground">
              Vui lòng đeo tai nghe và nhấn nút phát thử để kiểm tra âm thanh.
            </p>
            <button
              type="button"
              onClick={playTestSound}
              className="inline-flex items-center gap-2 rounded-lg border border-primary px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10"
            >
              {playing ? "Đang phát thử..." : "Phát thử âm thanh"}
            </button>
            <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
              <span aria-hidden="true">⚠</span>
              Nếu bạn không nghe rõ, vui lòng báo cho giáo viên.
            </p>
            <div className="border-t border-border pt-4">
              <button
                type="button"
                onClick={onContinue}
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
              >
                Tiếp tục
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                Bấm Tiếp tục để vào bài — audio sẽ tự động phát.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
