"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { shareAiImprovedText } from "@/lib/actions/ai-grading";

// Nút "Gửi bản nâng cấp cho học viên" ở trang chấm của thầy. Bản đã gửi là bản chụp
// (Answer.aiImprovedText): thầy chấm AI lại ra bản khác thì báo "học viên đang xem
// bản cũ" để thầy quyết có gửi bản mới hay không.
export function AiImprovedShare({
  answerId,
  sharedText,
  currentText
}: {
  answerId: string;
  sharedText: string | null;
  currentText: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(share: boolean) {
    setPending(true);
    setError(null);
    try {
      const result = await shareAiImprovedText(answerId, share);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.message);
      }
    } catch {
      setError("Không gọi được máy chủ. Kiểm tra mạng rồi thử lại.");
    } finally {
      setPending(false);
    }
  }

  const shared = sharedText !== null;
  const outdated = shared && sharedText !== currentText;
  const primary =
    "rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60";
  const secondary =
    "rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-60";

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {!shared ? (
          <button type="button" disabled={pending} onClick={() => run(true)} className={primary}>
            {pending ? "Đang gửi…" : "📤 Gửi bản nâng cấp cho học viên"}
          </button>
        ) : (
          <>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {outdated ? "Học viên đang xem bản nâng cấp CŨ" : "✓ Đã gửi cho học viên"}
            </span>
            {outdated ? (
              <button type="button" disabled={pending} onClick={() => run(true)} className={primary}>
                Gửi bản mới
              </button>
            ) : null}
            <button type="button" disabled={pending} onClick={() => run(false)} className={secondary}>
              Thu hồi
            </button>
          </>
        )}
      </div>
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
