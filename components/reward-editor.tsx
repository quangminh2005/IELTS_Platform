"use client";

import { useState } from "react";
import { ActionForm, ActionSubmitButton } from "@/components/action-form";
import { RewardArt } from "@/components/shop/reward-card";
import { useToast } from "@/components/toast";
import { saveReward } from "@/lib/actions/rewards";
import { REWARD_EMOJI_SUGGESTIONS } from "@/lib/rewards";

export type RewardEditorValue = {
  id: string;
  emoji: string;
  imageUrl: string | null;
  name: string;
  description: string | null;
  price: number;
  stock: number | null;
  limitPerStudent: number | null;
  limitPeriod: string;
};

const IMAGE_WIDTH = 640;
const IMAGE_HEIGHT = 400; // khổ 16:10 như thẻ quà

// Cắt giữa về khổ 16:10 + thu về 640×400 + xuất webp NGAY TRONG TRÌNH DUYỆT trước
// khi gửi (ảnh chụp điện thoại 3–5MB còn khoảng 30–60KB) — tiết kiệm băng thông Blob.
async function shrinkToCardWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const targetRatio = IMAGE_WIDTH / IMAGE_HEIGHT;
  const sourceRatio = bitmap.width / bitmap.height;
  const cropWidth = sourceRatio > targetRatio ? bitmap.height * targetRatio : bitmap.width;
  const cropHeight = sourceRatio > targetRatio ? bitmap.height : bitmap.width / targetRatio;

  const canvas = document.createElement("canvas");
  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không xử lý được ảnh này.");

  ctx.drawImage(
    bitmap,
    (bitmap.width - cropWidth) / 2,
    (bitmap.height - cropHeight) / 2,
    cropWidth,
    cropHeight,
    0,
    0,
    IMAGE_WIDTH,
    IMAGE_HEIGHT
  );
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Không nén được ảnh."))), "image/webp", 0.82);
  });
}

const fieldClass = "rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none";
const inputClass = `w-full ${fieldClass}`;
const labelClass = "block text-xs font-semibold text-muted-foreground";

// Form thêm/sửa một món quà. Ảnh tải lên trước (qua /api/image/direct-upload), form
// chỉ gửi link ảnh trong ô ẩn.
export function RewardEditor({ initial, onDone }: { initial?: RewardEditorValue; onDone: () => void }) {
  const { notify } = useToast();
  const [emoji, setEmoji] = useState(initial?.emoji ?? "🎁");
  const [name, setName] = useState(initial?.name ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const blob = await shrinkToCardWebp(file);
      const extension = blob.type === "image/webp" ? "webp" : "png";
      const body = new FormData();
      body.append("file", new File([blob], `qua-${Date.now()}.${extension}`, { type: blob.type }));
      const response = await fetch("/api/image/direct-upload", { method: "POST", body });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error ?? "Tải ảnh thất bại.");
      setImageUrl(data.url);
    } catch (error) {
      notify({ ok: false, message: (error as Error).message || "Tải ảnh thất bại." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <ActionForm
      action={saveReward}
      onResult={(result) => {
        if (result.ok) onDone();
      }}
      className="grid gap-4 rounded-xl border border-primary/40 bg-card p-4 shadow-card md:grid-cols-[220px_1fr]"
    >
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="imageUrl" value={imageUrl} />

      <div className="space-y-2">
        <div className="overflow-hidden rounded-lg border border-border">
          <RewardArt emoji={emoji || "🎁"} imageUrl={imageUrl || null} name={name || "Món quà"} />
        </div>
        <label className="block">
          <span className={labelClass}>Ảnh thật (tuỳ chọn)</span>
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(event) => handleFile(event.target.files?.[0])}
            className="mt-1 block w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-semibold"
          />
        </label>
        {uploading ? <p className="text-xs text-muted-foreground">Đang nén & tải ảnh…</p> : null}
        {imageUrl ? (
          <button type="button" onClick={() => setImageUrl("")} className="text-xs font-semibold text-rose-600 hover:underline">
            Bỏ ảnh, dùng emoji
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={labelClass}>Emoji</span>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <input
              name="emoji"
              value={emoji}
              onChange={(event) => setEmoji(event.target.value)}
              maxLength={16}
              className={`${fieldClass} w-16 text-center text-lg`}
              required
            />
            {REWARD_EMOJI_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setEmoji(suggestion)}
                className={`h-9 w-9 rounded-lg border text-lg transition hover:border-primary ${
                  emoji === suggestion ? "border-primary bg-primary/10" : "border-border"
                }`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </label>
        <label className="sm:col-span-2">
          <span className={labelClass}>Tên món quà</span>
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            placeholder="Trà sữa trân châu"
            className={`${inputClass} mt-1`}
            required
          />
        </label>
        <label className="sm:col-span-2">
          <span className={labelClass}>Mô tả (tuỳ chọn)</span>
          <input
            name="description"
            defaultValue={initial?.description ?? ""}
            maxLength={300}
            placeholder="Size M, nhận vào buổi học kế tiếp"
            className={`${inputClass} mt-1`}
          />
        </label>
        <label>
          <span className={labelClass}>Giá (Xu)</span>
          <input
            name="price"
            type="number"
            min={1}
            max={100000}
            defaultValue={initial?.price ?? 300}
            className={`${inputClass} mt-1`}
            required
          />
        </label>
        <label>
          <span className={labelClass}>Tổng số lượng (trống = không giới hạn)</span>
          <input
            name="stock"
            type="number"
            min={1}
            max={10000}
            defaultValue={initial?.stock ?? ""}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label>
          <span className={labelClass}>Mỗi em tối đa (trống = không giới hạn)</span>
          <input
            name="limitPerStudent"
            type="number"
            min={1}
            max={100}
            defaultValue={initial?.limitPerStudent ?? ""}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label>
          <span className={labelClass}>Tính giới hạn theo</span>
          <select name="limitPeriod" defaultValue={initial?.limitPeriod ?? "month"} className={`${inputClass} mt-1`}>
            <option value="month">Mỗi tháng</option>
            <option value="ever">Từ trước tới nay</option>
          </select>
        </label>
        <div className="flex gap-2 sm:col-span-2">
          {/* Đang tải ảnh thì chưa cho lưu — ô imageUrl ẩn chưa có link mới. */}
          {uploading ? (
            <button type="button" disabled className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground opacity-60">
              Đang tải ảnh…
            </button>
          ) : (
            <ActionSubmitButton
              pendingLabel="Đang lưu…"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {initial ? "Lưu thay đổi" : "Thêm món quà"}
            </ActionSubmitButton>
          )}
          <button type="button" onClick={onDone} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
            Huỷ
          </button>
        </div>
      </div>
    </ActionForm>
  );
}
