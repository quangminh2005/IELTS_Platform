"use client";

import { useRef } from "react";
import { BAND_OPTIONS_COMMON, BAND_OPTIONS_LOW } from "@/lib/writing-review";

// Hàng nút chọn band: một chạm thay vì mở <select> rồi dò trong 19 dòng. Chấm
// một lớp 20 bài là tiết kiệm được vài trăm cú bấm.
//
// Dùng đúng khuôn radiogroup của ARIA: cả nhóm chỉ có MỘT điểm dừng Tab (nút
// đang chọn, hoặc nút đầu nếu chưa chọn), rồi mũi tên trái/phải chạy trong nhóm.
// Nếu để cả 11 nút đều nhận Tab thì đi hết một tiêu chí đã mất 11 lần bấm Tab.
export function BandPicker({
  label,
  value,
  onChange,
  showLow
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  // Mở dải 0.0–3.5 (hiếm dùng nên mặc định ẩn).
  showLow: boolean;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const options = showLow ? [...BAND_OPTIONS_LOW, ...BAND_OPTIONS_COMMON] : BAND_OPTIONS_COMMON;
  const selectedIndex = options.findIndex((band) => String(band) === value);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : event.key === "Home"
            ? -options.length
            : event.key === "End"
              ? options.length
              : 0;

    if (step === 0) {
      return;
    }

    event.preventDefault();

    const from = selectedIndex >= 0 ? selectedIndex : 0;
    const next = Math.min(options.length - 1, Math.max(0, from + step));

    onChange(String(options[next]));
    // Giữ tiêu điểm theo nút vừa chọn để mũi tên bấm tiếp vẫn chạy trong nhóm.
    const buttons = groupRef.current?.querySelectorAll("button");
    (buttons?.[next] as HTMLButtonElement | undefined)?.focus();
  }

  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {value !== "" ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-[11px] text-muted-foreground underline underline-offset-2 transition hover:text-foreground"
          >
            bỏ chọn
          </button>
        ) : null}
      </div>

      <div
        ref={groupRef}
        role="radiogroup"
        aria-label={label}
        onKeyDown={handleKeyDown}
        className={`grid gap-0.5 ${showLow ? "grid-cols-10" : "grid-cols-11"}`}
      >
        {options.map((band, index) => {
          const raw = String(band);
          const selected = value === raw;

          return (
            <button
              key={band}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (selectedIndex < 0 && index === 0) ? 0 : -1}
              onClick={() => onChange(selected ? "" : raw)}
              className={`rounded border py-1 text-[11px] tabular-nums transition ${
                selected
                  ? "border-primary bg-primary font-semibold text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              {band.toFixed(1)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
