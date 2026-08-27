"use client";

import { useId, useRef, useState } from "react";
import { ActionForm, type ServerAction } from "@/components/action-form";
import { StudentAvatar } from "@/components/student-avatar";
import {
  AVATAR_PRESETS,
  COVER_COLORS,
  DEFAULT_COVER_KEY
} from "@/lib/student-avatar";

const BIO_LIMIT = 280;

// ProfileEditor có HAI CHẾ ĐỘ khác nhau, tuỳ theo ai đang sửa hồ sơ:
//
// - mode="self" (mặc định, dùng ở trang hồ sơ học viên, action=updateMyProfile):
//   học viên sở hữu cả 5 trường trang trí, form LUÔN gửi đủ cả 5 mỗi lần submit
//   — kể cả khi giá trị là rỗng. Đây là cách nút "Xoá ảnh" và xoá trắng bio hoạt
//   động: "vắng mặt trên FormData" và "" là một, server (readDecoration) coi cả
//   hai là "muốn xoá trắng". TUYỆT ĐỐI không được thay đổi hành vi này.
//
// - mode="teacherPatch" (dùng ở trang giáo viên xem học viên, action=
//   updateStudentProfile): giáo viên KHÔNG sở hữu bio/avatar/màu bìa/mục tiêu
//   band của học viên — đây là quyết định có chủ ý của chủ dự án để một giáo
//   viên chỉ sửa tên/email không bao giờ vô tình xoá bio/avatar học viên tự
//   chọn (server có readDecorationPatch() + formData.has(...) để xử lý đúng
//   điều này). Nhưng nếu form vẫn render sẵn cả 5 hidden input như mode="self"
//   thì formData.has(...) LUÔN đúng, và nhánh "để nguyên" của server không bao
//   giờ được kích hoạt — giáo viên mở form, chỉ đọc rồi lưu, vẫn ghi đè cả 5
//   trường bằng giá trị CŨ đã nạp lúc mở trang. Nếu học viên vừa tự sửa hồ sơ
//   trong lúc giáo viên đang mở form thì bản lưu mới nhất của học viên bị đè
//   mất — với avatar còn tệ hơn: deleteOldAvatar() sẽ xoá vĩnh viễn ảnh mới
//   học viên vừa tải lên. Nên ở chế độ này, MỖI hidden input chỉ được render
//   (và do đó chỉ được gửi lên) khi giáo viên THỰC SỰ chạm vào đúng ô đó trong
//   phiên chỉnh sửa này ("touched") — chỉ mở form ra xem KHÔNG tính là chạm.
type ProfileEditorMode = "self" | "teacherPatch";

type DecorationField = "bio" | "avatarUrl" | "avatarPreset" | "coverColor" | "targetBand";

// Cắt vuông + thu về 256px + xuất webp NGAY TRONG TRÌNH DUYỆT trước khi gửi.
// Ảnh gốc từ điện thoại thường 3–5MB; sau bước này còn khoảng 20KB.
async function shrinkToSquareWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Trình duyệt không xử lý được ảnh này.");
  }

  // Cắt phần vuông ở giữa ảnh gốc rồi vẽ đầy khung 256x256.
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    256,
    256
  );
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Không nén được ảnh.")),
      "image/webp",
      0.85
    );
  });
}

export function ProfileEditor({
  action,
  initial,
  extraFields,
  mode = "self",
  onDone
}: {
  action: ServerAction;
  initial: {
    displayName: string;
    bio: string | null;
    avatarUrl: string | null;
    avatarPreset: string | null;
    userImage: string | null;
    coverColor: string | null;
    targetBand: number | null;
  };
  extraFields?: React.ReactNode;
  mode?: ProfileEditorMode;
  onDone?: () => void;
}) {
  const [bio, setBio] = useState(initial.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [avatarPreset, setAvatarPreset] = useState(initial.avatarPreset);
  const [coverColor, setCoverColor] = useState(initial.coverColor ?? DEFAULT_COVER_KEY);
  const [targetBand, setTargetBand] = useState(
    initial.targetBand != null ? String(initial.targetBand) : ""
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const fileInputId = useId();

  // Chỉ có ý nghĩa ở mode="teacherPatch" — ghi lại những ô giáo viên đã THỰC SỰ
  // chạm tới trong phiên chỉnh sửa này (xem chú thích ProfileEditorMode ở đầu
  // file). Ở mode="self" biến này vẫn được cập nhật (vô hại) nhưng không được
  // đọc tới ở đâu cả — shouldPost() luôn trả về true khi mode="self".
  const [touchedFields, setTouchedFields] = useState<Set<DecorationField>>(new Set());

  function touch(...fields: DecorationField[]) {
    setTouchedFields((prev) => {
      const next = new Set(prev);
      for (const field of fields) {
        next.add(field);
      }
      return next;
    });
  }

  // avatarUrl và avatarPreset loại trừ lẫn nhau (xem chú thích ở các handler bên
  // dưới) — chạm vào MỘT trong hai luôn phải đánh dấu CẢ HAI đã chạm, vì bộ đôi
  // này chỉ đúng khi cả hai cùng được gửi lên (giá trị mới ở một ô, "" ở ô kia).
  function touchAvatar() {
    touch("avatarUrl", "avatarPreset");
  }

  // mode="self": luôn gửi (giữ đúng hành vi "vắng mặt = xoá trắng" cho học viên).
  // mode="teacherPatch": chỉ gửi ô giáo viên đã thực sự chạm trong phiên này.
  function shouldPost(field: DecorationField) {
    return mode === "self" || touchedFields.has(field);
  }

  // Đếm số "lượt quyết định avatar" (bắt đầu tải ảnh mới / chọn preset / xoá ảnh).
  // Mỗi lượt tải ảnh ghi lại số thứ tự của chính nó lúc bắt đầu; khi kết quả về,
  // chỉ áp dụng nếu số này vẫn còn là lượt mới nhất — nhờ vậy một lượt tải chậm
  // (mạng điện thoại) không bao giờ đè lên lựa chọn học viên đã chọn sau đó,
  // kể cả khi có 2 lượt tải ảnh chồng lên nhau.
  const avatarActionRef = useRef(0);

  async function handleFile(file: File) {
    const token = ++avatarActionRef.current;
    setUploadError(null);
    setUploading(true);

    try {
      const shrunk = await shrinkToSquareWebp(file);
      const body = new FormData();
      body.append("file", new File([shrunk], "avatar.webp", { type: "image/webp" }));

      const response = await fetch("/api/student/avatar", { method: "POST", body });
      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Tải ảnh không thành công.");
      }

      // Học viên đã đổi ý (chọn ảnh khác / preset / xoá ảnh) trong lúc chờ —
      // kết quả tải chậm này đã lỗi thời, bỏ qua để không đè lên lựa chọn mới hơn.
      if (avatarActionRef.current !== token) {
        return;
      }

      setAvatarUrl(payload.url);
      setAvatarPreset(null); // ảnh tự tải thắng avatar có sẵn
      touchAvatar();
    } catch (error) {
      if (avatarActionRef.current === token) {
        setUploadError((error as Error).message);
      }
    } finally {
      if (avatarActionRef.current === token) {
        setUploading(false);
      }
      if (fileInput.current) {
        fileInput.current.value = "";
      }
    }
  }

  return (
    <ActionForm action={action} className="space-y-5" onResult={() => onDone?.()}>
      {extraFields}
      {shouldPost("bio") ? <input type="hidden" name="bio" value={bio} /> : null}
      {shouldPost("avatarUrl") ? (
        <input type="hidden" name="avatarUrl" value={avatarUrl ?? ""} />
      ) : null}
      {shouldPost("avatarPreset") ? (
        <input type="hidden" name="avatarPreset" value={avatarPreset ?? ""} />
      ) : null}
      {shouldPost("coverColor") ? (
        <input type="hidden" name="coverColor" value={coverColor} />
      ) : null}
      {shouldPost("targetBand") ? (
        <input type="hidden" name="targetBand" value={targetBand} />
      ) : null}

      <div className="flex items-center gap-4">
        <StudentAvatar
          avatarUrl={avatarUrl}
          avatarPreset={avatarPreset}
          userImage={initial.userImage}
          displayName={initial.displayName}
          size="xl"
        />
        <div className="space-y-2">
          {/* Ô chọn file thật bị ẩn bằng class sr-only, KHÔNG dùng thuộc tính hidden
              — thuộc tính hidden thua class Tailwind và ô sẽ hiện lại. */}
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            id={fileInputId}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleFile(file);
              }
            }}
          />
          <label
            htmlFor={fileInputId}
            className="inline-flex cursor-pointer items-center rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:border-primary hover:text-primary"
          >
            {uploading ? "Đang tải ảnh…" : "Tải ảnh lên"}
          </label>
          {avatarUrl ? (
            <button
              type="button"
              onClick={() => {
                avatarActionRef.current += 1; // huỷ lượt tải ảnh đang chờ (nếu có)
                setAvatarUrl(null);
                setUploadError(null);
                setUploading(false);
                touchAvatar();
              }}
              className="ml-2 text-sm text-muted-foreground underline"
            >
              Xoá ảnh
            </button>
          ) : null}
          {uploadError ? (
            <p className="text-sm text-rose-500">{uploadError}</p>
          ) : null}
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Hoặc chọn avatar có sẵn</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {AVATAR_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              disabled={uploading}
              aria-pressed={avatarPreset === preset.key}
              onClick={() => {
                avatarActionRef.current += 1; // huỷ lượt tải ảnh đang chờ (nếu có)
                setAvatarPreset(preset.key);
                setAvatarUrl(null);
                setUploadError(null);
                setUploading(false);
                touchAvatar();
              }}
              className={`flex h-11 w-11 items-center justify-center rounded-full text-xl disabled:cursor-not-allowed disabled:opacity-50 ${preset.colorClass} ${
                avatarPreset === preset.key ? "ring-2 ring-primary ring-offset-2" : ""
              }`}
            >
              {preset.emoji}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold">Màu bìa</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {COVER_COLORS.map((cover) => (
            <button
              key={cover.key}
              type="button"
              disabled={uploading}
              aria-pressed={coverColor === cover.key}
              aria-label={`Màu bìa ${cover.key}`}
              onClick={() => {
                setCoverColor(cover.key);
                touch("coverColor");
              }}
              className={`h-11 w-16 rounded-lg disabled:cursor-not-allowed disabled:opacity-50 ${cover.className} ${
                coverColor === cover.key ? "ring-2 ring-primary ring-offset-2" : ""
              }`}
            />
          ))}
        </div>
      </fieldset>

      <label className="block space-y-1">
        <span className="text-sm font-semibold">Giới thiệu</span>
        <textarea
          value={bio}
          maxLength={BIO_LIMIT}
          rows={3}
          onChange={(event) => {
            setBio(event.target.value);
            touch("bio");
          }}
          placeholder="Vài dòng về bạn…"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />
        <span className="block text-right text-xs text-muted-foreground">
          {bio.length}/{BIO_LIMIT}
        </span>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-semibold">Mục tiêu band</span>
        {/* Không đặt name ở đây — giá trị thật được gửi qua hidden input
            "targetBand" phía trên (cùng cách xử lý với 4 trường trang trí còn
            lại), để việc "có gửi lên hay không" được quyết định thống nhất bởi
            shouldPost("targetBand") thay vì tự ô này gửi thẳng lên form. */}
        <input
          type="number"
          step="0.5"
          min="0"
          max="9"
          value={targetBand}
          onChange={(event) => {
            setTargetBand(event.target.value);
            touch("targetBand");
          }}
          className="w-32 rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />
      </label>

      <button
        type="submit"
        disabled={uploading}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        Lưu hồ sơ
      </button>
    </ActionForm>
  );
}
