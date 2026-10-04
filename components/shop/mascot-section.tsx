"use client";

import { useState } from "react";
import { ActionForm, ActionSubmitButton } from "@/components/action-form";
import { MascotArt } from "@/components/shop/mascot-art";
import { buyMascot, equipMascot, unlockPose } from "@/lib/actions/mascot";
import type { MascotId, PoseId } from "@/lib/mascots";
import type { ItemRarity } from "@/lib/shop-catalog";

const numberFormat = new Intl.NumberFormat("vi-VN");

const PILL = "inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition";

const RARITY_BADGE: Record<ItemRarity, string> = {
  common: "bg-slate-600/85 text-white",
  rare: "bg-sky-600/90 text-white",
  epic: "bg-violet-600/90 text-white",
  legendary: "bg-amber-500 text-white",
  achievement: "bg-rose-600/90 text-white"
};

export type MascotPoseView = {
  key: string;
  id: PoseId;
  name: string;
  price: number;
  streakDays: number | null;
  owned: boolean;
};

// Một khối linh vật trong tab Linh vật của Cửa hàng, kiểu chin: hình to bên trái,
// hàng "Chọn tư thế" bên phải (vuốt ngang trên điện thoại). Bấm ô tư thế = xem thử,
// kể cả khi chưa có. Mọi nút tốn Xu đều 2 bước (không dùng window.confirm).
export function MascotSection({
  id,
  name,
  description,
  price,
  rarity,
  rarityLabel,
  ownedMascot,
  poses,
  equippedKey,
  coins,
  streakDays
}: {
  id: MascotId;
  name: string;
  description: string;
  price: number;
  rarity: ItemRarity;
  rarityLabel: string;
  ownedMascot: boolean;
  poses: MascotPoseView[];
  equippedKey: string | null;
  coins: number;
  streakDays: number;
}) {
  const equippedHere = poses.find((pose) => pose.key === equippedKey) ?? null;
  const [selectedKey, setSelectedKey] = useState(equippedHere?.key ?? poses[0].key);
  const [confirming, setConfirming] = useState<"buy" | "unlock" | null>(null);
  const selected = poses.find((pose) => pose.key === selectedKey) ?? poses[0];

  function select(key: string) {
    setSelectedKey(key);
    setConfirming(null);
  }

  return (
    <section
      className={`overflow-hidden rounded-xl border bg-card shadow-card ${
        equippedHere ? "border-primary ring-2 ring-primary/30" : "border-border"
      }`}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3">
        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${RARITY_BADGE[rarity]}`}>
          {rarityLabel}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold leading-tight">{name}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {ownedMascot ? (
          <span className={`${PILL} cursor-default border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300`}>
            ✓ Đã có
          </span>
        ) : coins < price ? (
          <div className="flex flex-col items-end gap-0.5">
            <span className={`${PILL} cursor-default border border-border tabular-nums text-muted-foreground`}>
              🪙 {numberFormat.format(price)}
            </span>
            <span className="text-xs text-muted-foreground">Thiếu {numberFormat.format(price - coins)} Xu</span>
          </div>
        ) : confirming === "buy" ? (
          <ActionForm action={buyMascot} onResult={() => setConfirming(null)} className="flex flex-wrap items-center justify-end gap-1.5">
            <input type="hidden" name="mascotId" value={id} />
            <span className="w-full text-right text-xs text-muted-foreground sm:w-auto">
              Còn lại {numberFormat.format(coins - price)} Xu
            </span>
            <button type="button" onClick={() => setConfirming(null)} className={`${PILL} border border-border hover:bg-muted`}>
              Huỷ
            </button>
            <ActionSubmitButton pendingLabel="Đang mua…" className={`${PILL} bg-amber-500 text-white hover:bg-amber-600`}>
              Mua luôn
            </ActionSubmitButton>
          </ActionForm>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming("buy")}
            className={`${PILL} bg-white text-slate-900 ring-1 ring-border tabular-nums hover:bg-amber-50 dark:ring-0`}
          >
            Mua · 🪙 {numberFormat.format(price)}
          </button>
        )}
      </header>

      <div className="grid gap-4 p-4 2xl:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
        {/* Xem thử tư thế đang chọn */}
        <div className="flex flex-col rounded-xl bg-muted/50">
          <MascotArt mascot={id} pose={selected.id} className="mx-auto aspect-square w-full max-w-[240px]" />
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-3">
            <p className="text-sm font-semibold">{selected.name}</p>
            <PoseAction
              pose={selected}
              mascotName={name}
              ownedMascot={ownedMascot}
              equipped={selected.key === equippedKey}
              coins={coins}
              streakDays={streakDays}
              confirming={confirming === "unlock"}
              setConfirming={(value) => setConfirming(value ? "unlock" : null)}
            />
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Chọn tư thế ({poses.length})
          </p>
          <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-2 2xl:flex-wrap 2xl:overflow-visible">
            {poses.map((pose) => {
              const isEquipped = pose.key === equippedKey;
              const isSelected = pose.key === selected.key;
              return (
                <button
                  key={pose.key}
                  type="button"
                  onClick={() => select(pose.key)}
                  aria-pressed={isSelected}
                  className={`relative flex w-24 shrink-0 flex-col items-center rounded-xl border bg-background px-1 pb-2 pt-1 text-center transition ${
                    isSelected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/60"
                  }`}
                >
                  {isEquipped ? (
                    <span className="absolute right-1 top-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                      ✓
                    </span>
                  ) : null}
                  <MascotArt
                    mascot={id}
                    pose={pose.id}
                    still
                    className={`h-16 w-16 ${ownedMascot && pose.owned ? "" : "opacity-60 grayscale-[35%]"}`}
                  />
                  <span className="mt-1 text-xs font-semibold leading-tight">{pose.name}</span>
                  <span className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                    {pose.owned && ownedMascot
                      ? "Đã có"
                      : pose.price === 0
                        ? "Kèm con"
                        : `🪙 ${numberFormat.format(pose.price)}`}
                  </span>
                  {pose.streakDays !== null && !(pose.owned && ownedMascot) ? (
                    <span className="text-[11px] font-semibold leading-tight text-amber-600 dark:text-amber-400">
                      🔥 hoặc chuỗi {pose.streakDays}n
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function PoseAction({
  pose,
  mascotName,
  ownedMascot,
  equipped,
  coins,
  streakDays,
  confirming,
  setConfirming
}: {
  pose: MascotPoseView;
  mascotName: string;
  ownedMascot: boolean;
  equipped: boolean;
  coins: number;
  streakDays: number;
  confirming: boolean;
  setConfirming: (value: boolean) => void;
}) {
  if (!ownedMascot) {
    return (
      <span className="text-xs text-muted-foreground">
        {pose.price === 0 ? "Có ngay khi mua con" : `Mua ${mascotName} trước để mở`}
      </span>
    );
  }

  if (equipped) {
    return (
      <ActionForm action={equipMascot}>
        <input type="hidden" name="poseKey" value="" />
        <ActionSubmitButton
          pendingLabel="Đang cất…"
          title="Bấm để cất linh vật"
          className={`${PILL} border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20`}
        >
          ✓ Đang dùng
        </ActionSubmitButton>
      </ActionForm>
    );
  }

  if (pose.owned) {
    return (
      <ActionForm action={equipMascot}>
        <input type="hidden" name="poseKey" value={pose.key} />
        <ActionSubmitButton pendingLabel="Đang trang bị…" className={`${PILL} bg-primary text-primary-foreground hover:bg-primary/90`}>
          Trang bị
        </ActionSubmitButton>
      </ActionForm>
    );
  }

  const streakReady = pose.streakDays !== null && streakDays >= pose.streakDays;

  if (confirming) {
    return (
      <ActionForm action={unlockPose} onResult={() => setConfirming(false)} className="flex flex-wrap items-center justify-end gap-1.5">
        <input type="hidden" name="poseKey" value={pose.key} />
        <input type="hidden" name="via" value="coins" />
        <span className="w-full text-right text-xs text-muted-foreground">Còn lại {numberFormat.format(coins - pose.price)} Xu</span>
        <button type="button" onClick={() => setConfirming(false)} className={`${PILL} border border-border hover:bg-muted`}>
          Huỷ
        </button>
        <ActionSubmitButton pendingLabel="Đang mở…" className={`${PILL} bg-amber-500 text-white hover:bg-amber-600`}>
          Mở luôn
        </ActionSubmitButton>
      </ActionForm>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1.5">
        {streakReady ? (
          // Mở bằng chuỗi không tốn gì → một bước.
          <ActionForm action={unlockPose}>
            <input type="hidden" name="poseKey" value={pose.key} />
            <input type="hidden" name="via" value="streak" />
            <ActionSubmitButton pendingLabel="Đang mở…" className={`${PILL} bg-orange-500 text-white hover:bg-orange-600`}>
              🔥 Mở bằng chuỗi
            </ActionSubmitButton>
          </ActionForm>
        ) : null}
        {coins >= pose.price ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={`${PILL} bg-white text-slate-900 ring-1 ring-border tabular-nums hover:bg-amber-50 dark:ring-0`}
          >
            Mở · 🪙 {numberFormat.format(pose.price)}
          </button>
        ) : (
          <span className={`${PILL} cursor-default border border-border tabular-nums text-muted-foreground`}>
            🪙 {numberFormat.format(pose.price)}
          </span>
        )}
      </div>
      {coins < pose.price ? (
        <span className="text-xs text-muted-foreground">Thiếu {numberFormat.format(pose.price - coins)} Xu</span>
      ) : null}
      {pose.streakDays !== null && !streakReady ? (
        <span className="text-xs text-muted-foreground">
          Hoặc giữ chuỗi {pose.streakDays} ngày (đang {streakDays})
        </span>
      ) : null}
    </div>
  );
}
