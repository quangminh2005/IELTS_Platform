"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatPlaybackRate, nextPlaybackRate } from "@/lib/playback-rate";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 translate-x-[1px]" aria-hidden="true">
    <path d="M8 5.14v13.72a1 1 0 0 0 1.53.85l10.79-6.86a1 1 0 0 0 0-1.7L9.53 4.29A1 1 0 0 0 8 5.14Z" />
  </svg>
);

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
    <path d="M7 4.5h3.2v15H7v-15Zm6.8 0H17v15h-3.2v-15Z" />
  </svg>
);

// Mũi tên tua lại kèm chữ "5"
const Rewind5Icon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
    <path
      d="M11 5.5a6.5 6.5 0 1 1-6.16 4.45"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path d="M5 5v3.4h3.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <text x="11" y="15.4" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor">
      5
    </text>
  </svg>
);

// Mũi tên tua tới kèm chữ "5"
const Forward5Icon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
    <path
      d="M13 5.5a6.5 6.5 0 1 0 6.16 4.45"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path d="M19 5v3.4h-3.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <text x="12" y="15.4" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor">
      5
    </text>
  </svg>
);

const VolumeIcon = ({ muted }: { muted: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
    <path
      d="M4 9.5v5h3.2L12 18.5v-13L7.2 9.5H4Z"
      fill="currentColor"
    />
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

type AudioPlayerProps = {
  src: string;
  // Tự phát khi vào bài. Nếu trình duyệt chặn autoplay (chưa có thao tác người
  // dùng trên trang), sẽ phát ngay ở lần bấm chuột/chạm đầu tiên bất kỳ.
  autoPlay?: boolean;
  // Nút đổi tốc độ phát. Chỉ dùng ở trang kết quả (nghe lại) — lúc thi thật KHÔNG
  // được cho đổi tốc độ nên mặc định tắt.
  showSpeed?: boolean;
  // Nhãn ngắn cho biết đang nghe phần nào (ví dụ "Nghe · Phần 1 · Câu 1–10").
  label?: string;
};

export function AudioPlayer({ src, autoPlay = false, showSpeed = false, label }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => setDuration(audio.duration);
    const onTime = () => setCurrentTime(audio.currentTime);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  useEffect(() => {
    if (!autoPlay) return;
    const audio = audioRef.current;
    if (!audio) return;

    let cancelled = false;
    const playOnFirstGesture = () => {
      if (!cancelled && audio.paused) {
        void audio.play().catch(() => undefined);
      }
    };

    audio.play().catch(() => {
      // Trình duyệt chặn autoplay → chờ thao tác đầu tiên của học viên rồi phát.
      window.addEventListener("pointerdown", playOnFirstGesture, { once: true });
    });

    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", playOnFirstGesture);
    };
  }, [autoPlay]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  }, []);

  const skip = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(
      Math.max(0, audio.currentTime + delta),
      audio.duration || 0
    );
  }, []);

  const handleSeek = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const value = Number(event.target.value);
    audio.currentTime = value;
    setCurrentTime(value);
  }, []);

  const handleVolume = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const value = Number(event.target.value);
    audio.volume = value;
    audio.muted = value === 0;
    setVolume(value);
    setMuted(value === 0);
  }, []);

  const cycleRate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = nextPlaybackRate(audio.playbackRate);
    audio.playbackRate = next;
    setRate(next);
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !audio.muted;
    audio.muted = next;
    setMuted(next);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const volumePct = (muted ? 0 : volume) * 100;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background/80 px-3 py-2 shadow-sm sm:gap-4 sm:px-4">
      <audio ref={audioRef} src={src} preload="metadata" controlsList="nodownload">
        <track kind="captions" />
      </audio>

      {/* Đang nghe phần nào (chỉ trang kết quả truyền vào) */}
      {label ? (
        <span className="hidden max-w-[15rem] shrink-0 truncate text-xs font-semibold text-muted-foreground lg:block">
          {label}
        </span>
      ) : null}

      {/* Nút phát/dừng chính */}
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Tạm dừng" : "Phát"}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform duration-150 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      {/* Tua lại 5s */}
      <button
        type="button"
        onClick={() => skip(-5)}
        aria-label="Tua lại 5 giây"
        className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex"
      >
        <Rewind5Icon />
      </button>

      {/* Thời gian hiện tại */}
      <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
        {formatTime(currentTime)}
      </span>

      {/* Thanh tiến trình */}
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={currentTime}
        onChange={handleSeek}
        aria-label="Tiến trình bài nghe"
        className="audio-range h-1.5 flex-1 cursor-pointer"
        style={{ "--audio-progress": `${progress}%` } as React.CSSProperties}
      />

      {/* Tổng thời gian */}
      <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
        {formatTime(duration)}
      </span>

      {/* Tua tới 5s */}
      <button
        type="button"
        onClick={() => skip(5)}
        aria-label="Tua tới 5 giây"
        className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex"
      >
        <Forward5Icon />
      </button>

      {/* Tốc độ phát — bấm để đổi lần lượt 1x → 1.25x → 1.5x → 0.75x */}
      {showSpeed ? (
        <button
          type="button"
          onClick={cycleRate}
          aria-label={`Tốc độ phát ${formatPlaybackRate(rate)}, bấm để đổi`}
          className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-bold tabular-nums text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {formatPlaybackRate(rate)}
        </button>
      ) : null}

      {/* Âm lượng */}
      <div className="hidden items-center gap-2 md:flex">
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Bật tiếng" : "Tắt tiếng"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
    </div>
  );
}
