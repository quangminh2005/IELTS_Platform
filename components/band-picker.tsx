"use client";

import { BAND_OPTIONS_COMMON, BAND_OPTIONS_LOW } from "@/lib/writing-review";

// Hàng nút chọn band: một chạm thay vì mở <select> rồi dò trong 19 dòng. Chấm
// một lớp 20 bài là tiết kiệm được vài trăm cú bấm.
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
  const options = showLow ? [...BAND_OPTIONS_LOW, ...BAND_OPTIONS_COMMON] : BAND_OPTIONS_COMMON;

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
        role="group"
        aria-label={label}
        className={`grid gap-0.5 ${showLow ? "grid-cols-10" : "grid-cols-11"}`}
      >
        {options.map((band) => {
          const raw = String(band);
          const selected = value === raw;

          return (
            <button
              key={band}
              type="button"
              aria-pressed={selected}
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
