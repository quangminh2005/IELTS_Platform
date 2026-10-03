"use client";

import { useState } from "react";
import { ActionForm, ActionSubmitButton } from "@/components/action-form";
import { restoreStreak } from "@/lib/actions/streak";

const numberFormat = new Intl.NumberFormat("vi-VN");

const PILL = "inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition";

// Khôi phục 2 bước ngay trên thẻ (không dùng window.confirm — cùng lý do Cửa hàng).
export function StreakRestoreButton({ price, coins }: { price: number; coins: number }) {
  const [confirming, setConfirming] = useState(false);

  if (coins < price) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${PILL} cursor-default border border-border tabular-nums text-muted-foreground`}>
          Khôi phục · 🪙 {numberFormat.format(price)}
        </span>
        <span className="text-xs text-muted-foreground">Thiếu {numberFormat.format(price - coins)} Xu</span>
      </div>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={`${PILL} bg-amber-500 tabular-nums text-white hover:bg-amber-600`}
      >
        Khôi phục · 🪙 {numberFormat.format(price)}
      </button>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">
        Trừ {numberFormat.format(price)} Xu? Còn lại {numberFormat.format(coins - price)} Xu.
      </p>
      <ActionForm action={restoreStreak} onResult={() => setConfirming(false)} className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className={`${PILL} border border-border hover:bg-muted`}
        >
          Huỷ
        </button>
        <ActionSubmitButton pendingLabel="Đang khôi phục…" className={`${PILL} bg-amber-500 text-white hover:bg-amber-600`}>
          Khôi phục luôn
        </ActionSubmitButton>
      </ActionForm>
    </div>
  );
}
