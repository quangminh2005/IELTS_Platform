"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getCelebration } from "@/lib/celebration";

const CONFETTI_COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#eab308"];

function confettiCount(level: "none" | "medium" | "big") {
  if (level === "big") return 80;
  if (level === "medium") return 40;
  return 0;
}

export function SubmitCelebration({
  scorePercent,
  isManualOnly,
  dominantSkill,
}: {
  scorePercent: number | null;
  isManualOnly: boolean;
  dominantSkill: string | null;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const justSubmitted = params.get("submitted") === "1";

  // Khởi tạo trạng thái mở từ lần render đầu; state giữ nguyên kể cả khi ta
  // xóa query bên dưới, nên pop-up không tự tắt khi param biến mất.
  const [open, setOpen] = useState(justSubmitted);

  useEffect(() => {
    if (justSubmitted) {
      // Xóa dấu hiệu để refresh trang không bật lại pop-up.
      router.replace(pathname, { scroll: false });
    }
    // Chỉ chạy một lần khi mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const celebration = useMemo(
    () => getCelebration({ scorePercent, isManualOnly, dominantSkill }),
    [scorePercent, isManualOnly, dominantSkill]
  );

  const pieces = useMemo(() => {
    const count = confettiCount(celebration.confetti);
    return Array.from({ length: count }, (_, index) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 2 + Math.random() * 1.5,
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    }));
  }, [celebration.confetti]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      {pieces.length > 0 ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {pieces.map((piece, index) => (
            <span
              key={index}
              className="confetti-piece"
              style={{
                left: `${piece.left}%`,
                backgroundColor: piece.color,
                animationDelay: `${piece.delay}s`,
                animationDuration: `${piece.duration}s`,
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card px-6 py-8 text-center shadow-card">
        <p className="text-4xl">
          {celebration.confetti === "big" ? "🎉" : celebration.tier === "manual" ? "📝" : "✅"}
        </p>
        <h3 className="mt-3 text-xl font-bold">{celebration.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{celebration.message}</p>
        {scorePercent !== null && !isManualOnly ? (
          <p className="mt-3 text-2xl font-bold tabular-nums text-primary">
            {Math.round(scorePercent)}%
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-5 w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          Tuyệt vời!
        </button>
      </div>
    </div>
  );
}
