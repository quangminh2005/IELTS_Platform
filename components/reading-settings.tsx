"use client";

import { useEffect, useId, useRef, useState } from "react";
import { applyTheme, getCurrentTheme } from "@/components/ui/animated-theme-toggle";
import { FONT_PRESETS, type ReadingTone } from "@/lib/reading-settings";

// Nút "Aa" ở thanh trên màn làm bài (kiểu nút "Cài đặt" của YouPass): cỡ chữ theo
// mức + màu nền dịu mắt. Gộp luôn nút sáng/tối vào đây — trước đó điện thoại phải
// ẩn nút sáng/tối vì header thiếu chỗ.
//
// "Tối" là chế độ tối của cả app (data-theme), ba màu còn lại là nền ở chế độ sáng:
// chọn một màu sáng khi đang tối thì chuyển app về sáng luôn.

type BackgroundChoice = ReadingTone | "dark";

const BACKGROUNDS: Array<{ key: BackgroundChoice; label: string; swatch: string; ink: string }> = [
  { key: "default", label: "Mặc định", swatch: "#ffffff", ink: "#0f172a" },
  { key: "sepia", label: "Giấy kem", swatch: "#f4ecdc", ink: "#33291b" },
  { key: "green", label: "Xanh dịu", swatch: "#e5eedf", ink: "#1c2e24" },
  { key: "dark", label: "Tối", swatch: "#111827", ink: "#e5e7eb" }
];

export function ReadingSettings({
  fontScale,
  onFontScale,
  tone,
  onTone
}: {
  fontScale: number;
  onFontScale: (scale: number) => void;
  tone: ReadingTone;
  onTone: (tone: ReadingTone) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    setDark(getCurrentTheme() === "dark");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // pointerdown chứ không phải click: chạm ra ngoài trên điện thoại cũng đóng.
    function onPointer(event: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function setTheme(next: "light" | "dark") {
    try {
      applyTheme(next);
    } catch {
      // localStorage bị chặn (tab riêng tư iOS) — data-theme vẫn đã được đặt.
    }
    setDark(next === "dark");
  }

  function chooseBackground(key: BackgroundChoice) {
    if (key === "dark") {
      setTheme("dark");
      return;
    }
    if (dark) setTheme("light");
    onTone(key);
  }

  const selectedBackground: BackgroundChoice = dark ? "dark" : tone;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Cài đặt hiển thị: cỡ chữ và màu nền"
        title="Cỡ chữ & màu nền"
        className={`inline-flex h-9 items-center gap-1 rounded-lg border px-2.5 text-sm font-bold transition hover:bg-muted ${
          open ? "border-primary text-primary" : "border-border text-foreground"
        }`}
      >
        <span aria-hidden="true">
          A<span className="text-xs">a</span>
        </span>
        <svg viewBox="0 0 20 20" className="h-3 w-3 opacity-60" fill="currentColor" aria-hidden="true">
          <path d="M5.5 7.5 10 12l4.5-4.5h-9Z" />
        </svg>
      </button>

      {open ? (
        // Điện thoại: neo theo màn hình (fixed, cách mép 8px) để bảng không tràn ra
        // ngoài — nút nằm giữa header, absolute right-0 sẽ thò quá mép trái.
        <div
          id={panelId}
          role="dialog"
          aria-label="Cài đặt hiển thị"
          className="fixed inset-x-2 top-16 z-[60] rounded-xl border border-border bg-card p-4 shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cỡ chữ</p>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {FONT_PRESETS.map((preset, index) => {
              const active = Math.abs(preset.scale - fontScale) < 0.001;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => onFontScale(preset.scale)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 transition ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground hover:border-primary/50"
                  }`}
                >
                  <span className="font-bold leading-none" style={{ fontSize: `${14 + index * 3}px` }} aria-hidden="true">
                    A
                  </span>
                  <span className="text-[11px] font-semibold">{preset.label}</span>
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Màu nền</p>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {BACKGROUNDS.map((item) => {
              const active = selectedBackground === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => chooseBackground(item.key)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2 transition ${
                    active ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-1 ring-black/10 ${
                      active ? "ring-2 ring-primary" : ""
                    }`}
                    style={{ background: item.swatch, color: item.ink }}
                  >
                    Aa
                  </span>
                  <span className={`text-[11px] font-semibold ${active ? "text-primary" : "text-foreground"}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
            Giấy kem / Xanh dịu đỡ chói khi đọc lâu. Cài đặt lưu trên máy này.
          </p>
        </div>
      ) : null}
    </div>
  );
}
