"use client";

import { useState } from "react";
import { ActionForm, ActionSubmitButton } from "@/components/action-form";
import { cancelRedemption, redeemReward } from "@/lib/actions/rewards";
import { LIMIT_PERIOD_LABELS, type RewardCardState } from "@/lib/rewards";

const numberFormat = new Intl.NumberFormat("vi-VN");

const PILL = "inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition";

// Hình món quà khổ 16:10: ảnh thật nếu thầy có tải, không thì emoji to trên nền ấm.
export function RewardArt({ emoji, imageUrl, name }: { emoji: string; imageUrl: string | null; name: string }) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl} alt={name} loading="lazy" className="aspect-[16/10] w-full object-cover" />
    );
  }

  return (
    <div className="flex aspect-[16/10] w-full items-center justify-center bg-gradient-to-br from-amber-100 via-orange-50 to-rose-100 dark:from-amber-500/20 dark:via-orange-500/10 dark:to-rose-500/20">
      <span className="text-6xl drop-shadow-sm" aria-hidden="true">
        {emoji}
      </span>
    </div>
  );
}

// Đổi 2 bước ngay trên thẻ (không dùng window.confirm — cùng lý do Cửa hàng).
export function RewardCard({
  id,
  emoji,
  imageUrl,
  name,
  description,
  price,
  remaining,
  limitPerStudent,
  limitPeriod,
  coins,
  state
}: {
  id: string;
  emoji: string;
  imageUrl: string | null;
  name: string;
  description: string | null;
  price: number;
  remaining: number | null;
  limitPerStudent: number | null;
  limitPeriod: string;
  coins: number;
  state: RewardCardState;
}) {
  const [confirming, setConfirming] = useState(false);
  const period = limitPeriod === "ever" ? LIMIT_PERIOD_LABELS.ever : LIMIT_PERIOD_LABELS.month;

  const hint =
    confirming && state === "redeemable"
      ? `Đổi với giá ${numberFormat.format(price)} Xu? Còn lại ${numberFormat.format(coins - price)} Xu.`
      : state === "short"
        ? `Còn thiếu ${numberFormat.format(price - coins)} Xu`
        : state === "limit"
          ? `Em đã đổi đủ ${limitPerStudent} lần ${period}`
          : description;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card ${
        state === "sold_out" ? "opacity-70" : ""
      }`}
    >
      <div className="relative">
        <RewardArt emoji={emoji} imageUrl={imageUrl} name={name} />
        {remaining !== null ? (
          <span
            className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              remaining > 0 ? "bg-slate-900/75 text-white" : "bg-rose-600/90 text-white"
            }`}
          >
            {remaining > 0 ? `Còn ${remaining}` : "Hết hàng"}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 text-sm font-semibold leading-tight sm:text-base">{name}</p>
          {state === "redeemable" && confirming ? (
            <ActionForm action={redeemReward} onResult={() => setConfirming(false)} className="flex gap-1.5">
              <input type="hidden" name="rewardId" value={id} />
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className={`${PILL} border border-border hover:bg-muted`}
              >
                Huỷ
              </button>
              <ActionSubmitButton pendingLabel="Đang đổi…" className={`${PILL} bg-amber-500 text-white hover:bg-amber-600`}>
                Đổi luôn
              </ActionSubmitButton>
            </ActionForm>
          ) : state === "redeemable" ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={`${PILL} bg-white text-slate-900 ring-1 ring-border tabular-nums hover:bg-amber-50 dark:ring-0`}
            >
              🪙 {numberFormat.format(price)}
            </button>
          ) : (
            <span className={`${PILL} cursor-default border border-border tabular-nums text-muted-foreground`}>
              {state === "sold_out" ? "Hết hàng" : state === "limit" ? "✓ Đã đổi" : `🪙 ${numberFormat.format(price)}`}
            </span>
          )}
        </div>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

// Nút huỷ phiếu đang chờ (2 bước) — em nhận lại Xu.
export function CancelRedemptionButton({ redemptionId, price }: { redemptionId: string; price: number }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-muted"
      >
        Huỷ phiếu
      </button>
    );
  }

  return (
    <ActionForm action={cancelRedemption} onResult={() => setConfirming(false)} className="flex items-center gap-1.5">
      <input type="hidden" name="redemptionId" value={redemptionId} />
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-muted"
      >
        Giữ
      </button>
      <ActionSubmitButton
        pendingLabel="Đang huỷ…"
        className="rounded-md bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-700"
      >
        Huỷ, hoàn {numberFormat.format(price)} Xu
      </ActionSubmitButton>
    </ActionForm>
  );
}
