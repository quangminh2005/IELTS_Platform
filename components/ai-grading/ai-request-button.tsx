"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AiActionResult } from "@/lib/actions/ai-grading";

// Nút gọi một server action AI chấm (thầy hoặc học viên). Xong thì tải lại dữ liệu
// trang để khung kết quả hiện ra; lỗi thì hiện ngay dưới nút.
export function AiRequestButton({
  attemptId,
  action,
  label,
  pendingLabel,
  disabled = false
}: {
  attemptId: string;
  action: (attemptId: string) => Promise<AiActionResult>;
  label: string;
  pendingLabel: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    try {
      const result = await action(attemptId);
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

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={run}
        disabled={disabled || pending}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? pendingLabel : label}
      </button>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
