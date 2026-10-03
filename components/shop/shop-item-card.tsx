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

const PILL = "inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition";

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
      {/* Hàng dưới kiểu chin: tên bên trái, nút giá/trang bị gọn bên phải. */}
      <div className="flex flex-1 flex-col gap-1 p-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 text-sm font-semibold leading-tight sm:text-base">{name}</p>
          {state === "equipped" ? (
            <ActionForm action={equipItem}>
              <input type="hidden" name="category" value={category} />
              <input type="hidden" name="itemKey" value="" />
              <ActionSubmitButton
                pendingLabel="Đang tháo…"
                title="Bấm để tháo"
                className={`${PILL} border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20`}
              >
                ✓ Đang dùng
              </ActionSubmitButton>
            </ActionForm>
          ) : state === "owned" ? (
            <ActionForm action={equipItem}>
              <input type="hidden" name="category" value={category} />
              <input type="hidden" name="itemKey" value={itemKey} />
              <ActionSubmitButton
                pendingLabel="Đang trang bị…"
                className={`${PILL} bg-primary text-primary-foreground hover:bg-primary/90`}
              >
                Trang bị
              </ActionSubmitButton>
            </ActionForm>
          ) : state === "locked" ? (
            <span className={`${PILL} cursor-default border border-border text-muted-foreground`}>🔒 Khoá</span>
          ) : state === "short" ? (
            <span className={`${PILL} cursor-default border border-border tabular-nums text-muted-foreground`}>
              🪙 {numberFormat.format(price ?? 0)}
            </span>
          ) : confirming ? (
            <ActionForm action={buyItem} onResult={() => setConfirming(false)} className="flex gap-1.5">
              <input type="hidden" name="itemKey" value={itemKey} />
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className={`${PILL} border border-border hover:bg-muted`}
              >
                Huỷ
              </button>
              <ActionSubmitButton pendingLabel="Đang mua…" className={`${PILL} bg-amber-500 text-white hover:bg-amber-600`}>
                Mua luôn
              </ActionSubmitButton>
            </ActionForm>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={`${PILL} bg-white text-slate-900 ring-1 ring-border tabular-nums hover:bg-amber-50 dark:ring-0`}
            >
              🪙 {numberFormat.format(price ?? 0)}
            </button>
          )}
        </div>
        {confirming && state === "buyable" ? (
          <p className="text-xs text-muted-foreground">
            Mua với giá {numberFormat.format(price ?? 0)} Xu? Còn lại {numberFormat.format(coins - (price ?? 0))} Xu.
          </p>
        ) : state === "short" ? (
          <p className="text-xs text-muted-foreground">
            Còn thiếu {numberFormat.format((price ?? 0) - coins)} Xu
          </p>
        ) : description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
