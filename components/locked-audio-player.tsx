"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Trình phát audio "chế độ thi thật" cho Listening: tự phát lần lượt audio của
// các phần theo thứ tự, KHÔNG cho dừng/tua — học viên chỉ thấy trạng thái đang
// phát và thanh chỉnh âm lượng (giống chin.edu.vn). Vị trí đang phát được lưu
// localStorage theo attempt để refresh trang không nghe lại từ đầu.

export type LockedTrack = {
  unitId: string;
  src: string;
  order: number;
};

type LockedListeningAudioProps = {
  tracks: LockedTrack[];
  // Khóa lưu tiến độ, vd `lockedAudio_<attemptId>` — mỗi attempt một tiến độ.
  storageKey: string;
};

type SavedProgress = {
  i: number;
  t: number;
};

function readProgress(storageKey: string): SavedProgress {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { i: 0, t: 0 };
    const parsed = JSON.parse(raw) as Partial<SavedProgress>;
    const i = Number(parsed.i);
    const t = Number(parsed.t);
    return {
      i: Number.isInteger(i) && i >= 0 ? i : 0,
      t: Number.isFinite(t) && t >= 0 ? t : 0
    };
  } catch {
    return { i: 0, t: 0 };
  }
}

const VolumeIcon = ({ muted }: { muted: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
    <path d="M4 9.5v5h3.2L12 18.5v-13L7.2 9.5H4Z" fill="currentColor" />
    {muted ? (
      <path d="m16 9.5 4 5m0-5-4 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    ) : (
      <>
        <path d="M15.5 9a4 4 0 0 1 0 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M17.8 7a7 7 0 0 1 0 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>
    )}
  </svg>
);

export function LockedListeningAudio({ tracks, storageKey }: LockedListeningAudioProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  // Vị trí cần tua tới khi track hiện tại nạp xong metadata (resume sau refresh).
  const resumeTimeRef = useRef(0);
  const lastSaveRef = useRef(0);

  // Đọc tiến độ đã lưu một lần lúc mount.
  const initial = useMemo(() => {
    if (typeof window === "undefined") return { i: 0, t: 0 };
    return readProgress(storageKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const [trackIndex, setTrackIndex] = useState(() => Math.min(initial.i, tracks.length));
  const [finished, setFinished] = useState(() => initial.i >= tracks.length);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    resumeTimeRef.current = initial.t;
  }, [initial]);

  const saveProgress = useCallback(
    (index: number, time: number) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify({ i: index, t: time }));
      } catch {
        // localStorage đầy/bị chặn thì thôi — chỉ mất tính năng resume.
      }
    },
    [storageKey]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || finished) return;

    const playOnFirstGesture = () => {
      if (audio.paused && !audio.ended) {
        void audio.play().catch(() => undefined);
      }
    };

    const onLoaded = () => {
      if (resumeTimeRef.current > 0 && resumeTimeRef.current < audio.duration - 1) {
        audio.currentTime = resumeTimeRef.current;
      }
      resumeTimeRef.current = 0;
      audio.play().catch(() => {
        // Bị chặn autoplay (hiếm — học viên vừa bấm "Tiếp tục") → phát ở cú bấm kế.
        window.addEventListener("pointerdown", playOnFirstGesture, { once: true });
      });
    };

    const onTime = () => {
      // Lưu tiến độ ~2s một lần để refresh không phát lại từ đầu.
      const now = Date.now();
      if (now - lastSaveRef.current >= 2000) {
        lastSaveRef.current = now;
        saveProgress(trackIndex, audio.currentTime);
      }
    };

    const onEnded = () => {
      const nextIndex = trackIndex + 1;
      saveProgress(nextIndex, 0);
      if (nextIndex >= tracks.length) {
        setFinished(true);
      } else {
        resumeTimeRef.current = 0;
        setTrackIndex(nextIndex);
      }
    };

    // Chặn dừng từ phím media/hệ thống: hễ bị pause giữa chừng là phát tiếp ngay.
    const onPause = () => {
      if (!audio.ended && audio.currentTime > 0) {
        void audio.play().catch(() => undefined);
      }
    };

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("pause", onPause);

    // Track đã sẵn metadata (đổi state nhưng cùng element) thì phát luôn.
    if (audio.readyState >= 1 && audio.paused) {
      onLoaded();
    }

    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("pause", onPause);
      window.removeEventListener("pointerdown", playOnFirstGesture);
    };
  }, [trackIndex, finished, tracks.length, saveProgress]);

  const handleVolume = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    const value = Number(event.target.value);
    if (audio) {
      audio.volume = value;
      audio.muted = value === 0;
    }
    setVolume(value);
    setMuted(value === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    const next = !muted;
    if (audio) {
      audio.muted = next;
    }
    setMuted(next);
  }, [muted]);

  const currentSrc = !finished ? tracks[trackIndex]?.src : undefined;
  const volumePct = (muted ? 0 : volume) * 100;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
      {currentSrc ? <audio ref={audioRef} src={currentSrc} preload="auto" /> : null}

      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {!finished ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        ) : null}
        <span
          className={[
            "relative inline-flex h-2.5 w-2.5 rounded-full",
            finished ? "bg-muted-foreground/50" : "bg-emerald-500"
          ].join(" ")}
        />
      </span>
      <span className="hidden whitespace-nowrap text-xs font-semibold text-muted-foreground sm:inline">
        {finished ? "Đã phát xong audio" : "Đang phát audio"}
      </span>

      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Bật tiếng" : "Tắt tiếng"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <VolumeIcon muted={muted || volume === 0} />
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={muted ? 0 : volume}
        onChange={handleVolume}
        aria-label="Âm lượng"
        className="audio-range h-1.5 w-20 cursor-pointer"
        style={{ "--audio-progress": `${volumePct}%` } as React.CSSProperties}
      />
    </div>
  );
}
