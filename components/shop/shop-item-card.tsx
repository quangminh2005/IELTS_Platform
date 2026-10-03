"use client";

import { useState, type ReactNode } from "react";
import { ActionForm, ActionSubmitButton } from "@/components/action-form";
import { buyItem, equipItem } from "@/lib/actions/shop";
import type { ItemCategory, ItemRarity } from "@/lib/shop-catalog";

const RARITY_BADGE: Record<ItemRarity, string> = {
  common: "bg-slate-600/85 text-white",
  rare: "bg-sky-600/90 text-white",
  epic: "bg-violet-600/90 text-white",
  legendary: "bg-amber-500 text-white",
  achievement: "bg-rose-600/90 text-white"
};

const numberFormat = new Intl.NumberFormat("vi-VN");

export type ShopCardState = "owned" | "equipped" | "buyable" | "short" | "locked";

const BUTTON = "w-full rounded-lg px-3 py-2 text-sm font-semibold transition";

// Mua 2 bước ngay trên thẻ (không dùng window.confirm — trên điện thoại hộp thoại
// gốc dễ bấm nhầm và chặn công cụ kiểm thử).
export function ShopItemCard({
  itemKey,
  name,
  category,
  rarity,
  rarityLabel,
  price,
  description,
  coins,
  state,
  preview
}: {
  itemKey: string;
  name: string;
  category: ItemCategory;
  rarity: ItemRarity;
  rarityLabel: string;
  price: number | null;
  description?: string;
  coins: number;
  state: ShopCardState;
  preview: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border bg-card shadow-card ${
        state === "equipped" ? "border-primary ring-2 ring-primary/30" : "border-border"
      }`}
    >
      <div className="relative">
        {preview}
        <span
          className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${RARITY_BADGE[rarity]}`}
        >
          {rarityLabel}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="text-sm font-semibold leading-tight">{name}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        <div className="mt-auto pt-1">
          {state === "equipped" ? (
            <ActionForm action={equipItem}>
              <input type="hidden" name="category" value={category} />
              <input type="hidden" name="itemKey" value="" />
              <ActionSubmitButton
                pendingLabel="Đang tháo…"
                className={`${BUTTON} border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20`}
              >
                ✓ Đang dùng · Tháo
              </ActionSubmitButton>
            </ActionForm>
          ) : state === "owned" ? (
            <ActionForm action={equipItem}>
              <input type="hidden" name="category" value={category} />
              <input type="hidden" name="itemKey" value={itemKey} />
              <ActionSubmitButton
                pendingLabel="Đang trang bị…"
                className={`${BUTTON} bg-primary text-primary-foreground hover:bg-primary/90`}
              >
                Trang bị
              </ActionSubmitButton>
            </ActionForm>
          ) : state === "locked" ? (
            <p className={`${BUTTON} cursor-default border border-border text-center text-muted-foreground`}>
              🔒 Mở bằng thành tích
            </p>
          ) : state === "short" ? (
            <p className={`${BUTTON} cursor-default border border-border text-center text-muted-foreground`}>
              <span className="block">🪙 {numberFormat.format(price ?? 0)}</span>
              <span className="block text-[11px] font-medium">còn thiếu {numberFormat.format((price ?? 0) - coins)}</span>
            </p>
          ) : confirming ? (
            <ActionForm action={buyItem} onResult={() => setConfirming(false)} className="flex gap-2">
              <input type="hidden" name="itemKey" value={itemKey} />
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className={`${BUTTON} border border-border hover:bg-muted`}
              >
                Huỷ
              </button>
              <ActionSubmitButton pendingLabel="Đang mua…" className={`${BUTTON} bg-amber-500 text-white hover:bg-amber-600`}>
                Mua luôn
              </ActionSubmitButton>
            </ActionForm>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={`${BUTTON} bg-amber-500 text-white hover:bg-amber-600`}
            >
              Mua 🪙 {numberFormat.format(price ?? 0)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
