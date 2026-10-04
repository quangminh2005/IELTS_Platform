"use client";

import { useState } from "react";
import { ActionForm, ActionSubmitButton } from "@/components/action-form";
import { RewardEditor, type RewardEditorValue } from "@/components/reward-editor";
import { RewardArt } from "@/components/shop/reward-card";
import { deleteReward, deliverRedemption, rejectRedemption, toggleRewardActive } from "@/lib/actions/rewards";
import { LIMIT_PERIOD_LABELS } from "@/lib/rewards";

const numberFormat = new Intl.NumberFormat("vi-VN");

export type RewardAdminItem = RewardEditorValue & {
  active: boolean;
  activeCount: number; // phiếu pending|delivered
  totalRedemptions: number; // mọi phiếu — > 0 thì không xoá được
};

const SMALL_BUTTON = "rounded-md border border-border px-2.5 py-1 text-xs font-semibold transition hover:bg-muted";

// Lưới món quà phía thầy + form thêm/sửa mở ngay tại chỗ.
export function RewardAdminList({ rewards }: { rewards: RewardAdminItem[] }) {
  // "new" = đang thêm món mới; id = đang sửa món đó; null = không mở form.
  const [editing, setEditing] = useState<string | null>(rewards.length === 0 ? "new" : null);

  return (
    <div className="space-y-4">
      {editing === "new" ? (
        <RewardEditor onDone={() => setEditing(null)} />
      ) : (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          + Thêm món quà
        </button>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rewards.map((reward) =>
          editing === reward.id ? (
            <div key={reward.id} className="sm:col-span-2 xl:col-span-3">
              <RewardEditor initial={reward} onDone={() => setEditing(null)} />
            </div>
          ) : (
            <div
              key={reward.id}
              className={`flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card ${
                reward.active ? "" : "opacity-60"
              }`}
            >
              <div className="relative">
                <RewardArt emoji={reward.emoji} imageUrl={reward.imageUrl} name={reward.name} />
                {!reward.active ? (
                  <span className="absolute left-2 top-2 rounded-md bg-slate-900/80 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    Đang ẩn
                  </span>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-semibold">{reward.name}</p>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-amber-600 dark:text-amber-300">
                    🪙 {numberFormat.format(reward.price)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {reward.stock === null
                    ? `Đã đổi ${reward.activeCount} · không giới hạn số lượng`
                    : `Đã đổi ${reward.activeCount}/${reward.stock} · còn ${Math.max(0, reward.stock - reward.activeCount)}`}
                  {reward.limitPerStudent !== null
                    ? ` · mỗi em ${reward.limitPerStudent} lần ${
                        reward.limitPeriod === "ever" ? LIMIT_PERIOD_LABELS.ever : LIMIT_PERIOD_LABELS.month
                      }`
                    : ""}
                </p>
                {reward.description ? <p className="text-xs text-muted-foreground">{reward.description}</p> : null}
                <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                  <button type="button" onClick={() => setEditing(reward.id)} className={SMALL_BUTTON}>
                    Sửa
                  </button>
                  <ActionForm action={toggleRewardActive}>
                    <input type="hidden" name="rewardId" value={reward.id} />
                    <ActionSubmitButton pendingLabel="…" className={SMALL_BUTTON}>
                      {reward.active ? "Ẩn" : "Hiện lại"}
                    </ActionSubmitButton>
                  </ActionForm>
                  {reward.totalRedemptions === 0 ? <DeleteRewardButton rewardId={reward.id} /> : null}
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function DeleteRewardButton({ rewardId }: { rewardId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={`${SMALL_BUTTON} text-rose-600`}>
        Xoá
      </button>
    );
  }

  return (
    <ActionForm action={deleteReward} onResult={() => setConfirming(false)} className="flex gap-1.5">
      <input type="hidden" name="rewardId" value={rewardId} />
      <button type="button" onClick={() => setConfirming(false)} className={SMALL_BUTTON}>
        Giữ
      </button>
      <ActionSubmitButton pendingLabel="Đang xoá…" className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white">
        Xoá hẳn
      </ActionSubmitButton>
    </ActionForm>
  );
}

// Hai nút cho một phiếu đang chờ: Đã trao / Từ chối (kèm ghi chú, hoàn Xu).
export function RedemptionActions({ redemptionId, price }: { redemptionId: string; price: number }) {
  const [rejecting, setRejecting] = useState(false);

  if (rejecting) {
    return (
      <ActionForm action={rejectRedemption} onResult={() => setRejecting(false)} className="flex w-full flex-wrap gap-1.5 sm:w-auto">
        <input type="hidden" name="redemptionId" value={redemptionId} />
        <input
          name="teacherNote"
          maxLength={200}
          placeholder="Lý do (tuỳ chọn)"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs sm:w-48"
        />
        <button type="button" onClick={() => setRejecting(false)} className={SMALL_BUTTON}>
          Thôi
        </button>
        <ActionSubmitButton pendingLabel="Đang hoàn…" className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white">
          Từ chối, hoàn {numberFormat.format(price)} Xu
        </ActionSubmitButton>
      </ActionForm>
    );
  }

  return (
    <div className="flex gap-1.5">
      <ActionForm action={deliverRedemption}>
        <input type="hidden" name="redemptionId" value={redemptionId} />
        <ActionSubmitButton
          pendingLabel="Đang lưu…"
          className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          ✓ Đã trao
        </ActionSubmitButton>
      </ActionForm>
      <button type="button" onClick={() => setRejecting(true)} className={`${SMALL_BUTTON} text-rose-600`}>
        Từ chối
      </button>
    </div>
  );
}
