"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from "react";
import { createPortal } from "react-dom";
import { ActionForm, ActionSubmitButton, type ServerAction } from "@/components/action-form";
import { ProfileCover } from "@/components/profile-cover";
import { BackgroundArt } from "@/components/shop/background-art";
import { StudentAvatar } from "@/components/student-avatar";
import type { ActionResult } from "@/lib/action-result";
import { shrinkCover, shrinkToSquareWebp } from "@/lib/image-shrink";
import { CUSTOM_COVER_KEY } from "@/lib/profile-cover";
import { resolveItem } from "@/lib/shop-catalog";
import { AVATAR_PRESETS, COVER_COLORS } from "@/lib/student-avatar";

const NAME_LIMIT = 40;
const BIO_LIMIT = 280;
// Ảnh gốc quá to thì trình duyệt điện thoại cũ có thể hết bộ nhớ khi giải mã.
const COVER_SOURCE_LIMIT = 15 * 1024 * 1024;

// Bản nháp hồ sơ trong bảng chỉnh sửa. Bìa phía sau hiện theo bản nháp này ngay
// lập tức (xem my-profile-hero.tsx); chỉ ghi DB khi bấm "Lưu thay đổi".
export type ProfileDraft = {
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  avatarPreset: string | null;
  coverColor: string;
  coverImageUrl: string | null;
  equippedBackground: string | null;
  equippedFrame: string | null;
  targetBand: string;
};

type UploadKind = "avatar" | "cover";

export function ProfileEditDrawer({
  action,
  draft,
  onChange,
  onClose,
  userImage,
  ownedBackgroundKeys,
  ownedFrameKeys
}: {
  action: ServerAction;
  draft: ProfileDraft;
  onChange: Dispatch<SetStateAction<ProfileDraft | null>>;
  onClose: () => void;
  userImage: string | null;
  ownedBackgroundKeys: string[];
  ownedFrameKeys: string[];
}) {
  const [mounted, setMounted] = useState(false);
  const [uploading, setUploading] = useState<UploadKind | null>(null);
  const [uploadError, setUploadError] = useState<{ kind: UploadKind; message: string } | null>(null);
  const avatarInputId = useId();
  const coverInputId = useId();
  const titleId = useId();

  // Đếm "lượt quyết định" riêng cho avatar và ảnh nền — cùng cách ProfileEditor:
  // kết quả tải chậm chỉ áp dụng nếu học viên chưa đổi ý sau đó.
  const tokens = useRef({ avatar: 0, cover: 0 });

  useEffect(() => {
    setMounted(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Cập nhật kiểu hàm: nhiều thao tác liền nhau (hoặc ảnh tải xong đúng lúc học
  // viên đang bấm) luôn chồng lên bản nháp MỚI NHẤT, không đè mất nhau.
  function patch(next: Partial<ProfileDraft> | ((current: ProfileDraft) => Partial<ProfileDraft>)) {
    onChange((current) =>
      current ? { ...current, ...(typeof next === "function" ? next(current) : next) } : current
    );
  }

  async function upload(kind: UploadKind, file: File) {
    const token = ++tokens.current[kind];
    setUploadError(null);
    setUploading(kind);

    try {
      if (kind === "cover" && file.size > COVER_SOURCE_LIMIT) {
        throw new Error("Ảnh quá lớn (tối đa 15 MB).");
      }

      const body = new FormData();
      if (kind === "avatar") {
        const shrunk = await shrinkToSquareWebp(file);
        body.append("file", new File([shrunk], "avatar.webp", { type: "image/webp" }));
      } else {
        body.append("file", await shrinkCover(file));
      }

      const response = await fetch(kind === "avatar" ? "/api/student/avatar" : "/api/student/cover", {
        method: "POST",
        body
      });
      const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Tải ảnh không thành công.");
      }

      if (tokens.current[kind] !== token) return; // đã đổi ý trong lúc chờ

      if (kind === "avatar") {
        patch({ avatarUrl: payload.url, avatarPreset: null });
      } else {
        patch({ coverImageUrl: payload.url, equippedBackground: CUSTOM_COVER_KEY });
      }
    } catch (error) {
      if (tokens.current[kind] === token) {
        setUploadError({ kind, message: (error as Error).message || "Tải ảnh không thành công." });
      }
    } finally {
      if (tokens.current[kind] === token) {
        setUploading(null);
      }
    }
  }

  // Huỷ lượt tải đang chờ của loại này (học viên vừa chọn thứ khác).
  function cancelUpload(kind: UploadKind) {
    tokens.current[kind] += 1;
    if (uploading === kind) setUploading(null);
    if (uploadError?.kind === kind) setUploadError(null);
  }

  function onResult(result: ActionResult) {
    if (result.ok) onClose();
  }

  const usingColor =
    draft.equippedBackground === null ||
    (draft.equippedBackground === CUSTOM_COVER_KEY && !draft.coverImageUrl);
  const backgrounds = ownedBackgroundKeys
    .map((key) => resolveItem(key))
    .filter((item): item is NonNullable<typeof item> => item?.category === "background");
  const frames = ownedFrameKeys
    .map((key) => resolveItem(key))
    .filter((item): item is NonNullable<typeof item> => item?.category === "frame");

  if (!mounted) return null;

  // Portal ra body: bảng nằm trong <main> có animate-fade-in (transform) — để
  // nguyên chỗ thì position:fixed bị neo theo khung đó chứ không theo màn hình.
  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Đóng bảng chỉnh sửa"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/40 backdrop-blur-[1px]"
      />
      <ActionForm
        action={action}
        onResult={onResult}
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-border bg-background shadow-2xl motion-safe:animate-drawer-in sm:w-[440px]"
      >
        <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="contents">
          {/* Mọi giá trị gửi lên đi qua hidden input, form luôn gửi ĐỦ các ô — xem
              readDecoration/readSelfExtras ở lib/actions/profile.ts. */}
          <input type="hidden" name="displayName" value={draft.displayName} />
          <input type="hidden" name="bio" value={draft.bio} />
          <input type="hidden" name="avatarUrl" value={draft.avatarUrl ?? ""} />
          <input type="hidden" name="avatarPreset" value={draft.avatarPreset ?? ""} />
          <input type="hidden" name="coverColor" value={draft.coverColor} />
          <input type="hidden" name="coverImageUrl" value={draft.coverImageUrl ?? ""} />
          <input type="hidden" name="equippedBackground" value={draft.equippedBackground ?? ""} />
          <input type="hidden" name="equippedFrame" value={draft.equippedFrame ?? ""} />
          <input type="hidden" name="targetBand" value={draft.targetBand} />

          <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 id={titleId} className="text-lg font-bold">
              Chỉnh sửa hồ sơ
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-lg text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              ×
            </button>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5">
            <Section title="Ảnh đại diện">
              <div className="flex flex-col items-center gap-4">
                <div className="py-3">
                  <StudentAvatar
                    avatarUrl={draft.avatarUrl}
                    avatarPreset={draft.avatarPreset}
                    userImage={userImage}
                    displayName={draft.displayName || "?"}
                    size="xl"
                    frame={draft.equippedFrame}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <FilePicker
                    id={avatarInputId}
                    disabled={uploading === "avatar"}
                    label={uploading === "avatar" ? "Đang tải…" : "Tải avatar"}
                    onFile={(file) => void upload("avatar", file)}
                  />
                  {draft.avatarUrl ? (
                    <button
                      type="button"
                      onClick={() => {
                        cancelUpload("avatar");
                        patch({ avatarUrl: null });
                      }}
                      className="text-sm text-muted-foreground underline hover:text-foreground"
                    >
                      Xoá ảnh
                    </button>
                  ) : null}
                </div>
                {uploadError?.kind === "avatar" ? (
                  <p className="text-sm text-rose-500">{uploadError.message}</p>
                ) : null}
                <div className="flex flex-wrap justify-center gap-2">
                  {AVATAR_PRESETS.map((preset) => {
                    const active = !draft.avatarUrl && draft.avatarPreset === preset.key;
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        aria-pressed={active}
                        aria-label={`Avatar ${preset.key}`}
                        onClick={() => {
                          cancelUpload("avatar");
                          patch({ avatarPreset: preset.key, avatarUrl: null });
                        }}
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${preset.colorClass} ${
                          active ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                        }`}
                      >
                        {preset.emoji}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Section>

            <Section title="Nền">
              <ProfileCover
                backgroundKey={draft.equippedBackground}
                coverColor={draft.coverColor}
                coverImageUrl={draft.coverImageUrl}
                className="h-36 rounded-lg"
              />

              <div className="mt-3 flex flex-wrap gap-2.5">
                {COVER_COLORS.map((cover) => {
                  const active = usingColor && draft.coverColor === cover.key;
                  return (
                    <button
                      key={cover.key}
                      type="button"
                      aria-pressed={active}
                      aria-label={`Màu bìa ${cover.key}`}
                      onClick={() => {
                        cancelUpload("cover");
                        patch({ coverColor: cover.key, equippedBackground: null });
                      }}
                      className={`h-9 w-9 rounded-full border border-white/40 ${cover.className} ${
                        active ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                      }`}
                    />
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <FilePicker
                  id={coverInputId}
                  disabled={uploading === "cover"}
                  label={uploading === "cover" ? "Đang nén & tải…" : "Tải ảnh riêng"}
                  onFile={(file) => void upload("cover", file)}
                />
                <span className="text-xs text-muted-foreground">Ảnh ngang đẹp nhất · tự nén trước khi tải</span>
              </div>
              {uploadError?.kind === "cover" ? (
                <p className="mt-2 text-sm text-rose-500">{uploadError.message}</p>
              ) : null}

              <p className="mt-4 text-sm font-medium text-muted-foreground">Nền đã mở khóa</p>
              {draft.coverImageUrl || backgrounds.length > 0 ? (
                <div className="mt-2 grid grid-cols-2 gap-2.5">
                  {draft.coverImageUrl ? (
                    <Tile
                      label="Ảnh của bạn"
                      active={draft.equippedBackground === CUSTOM_COVER_KEY}
                      onSelect={() => {
                        cancelUpload("cover");
                        patch({ equippedBackground: CUSTOM_COVER_KEY });
                      }}
                      onRemove={() => {
                        cancelUpload("cover");
                        patch((current) => ({
                          coverImageUrl: null,
                          equippedBackground:
                            current.equippedBackground === CUSTOM_COVER_KEY ? null : current.equippedBackground
                        }));
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={draft.coverImageUrl} alt="" className="h-full w-full object-cover" />
                    </Tile>
                  ) : null}
                  {backgrounds.map((item) => (
                    <Tile
                      key={item.key}
                      label={item.name}
                      active={draft.equippedBackground === item.key}
                      onSelect={() => {
                        cancelUpload("cover");
                        patch({ equippedBackground: item.key });
                      }}
                    >
                      <BackgroundArt artKey={item.artKey} className="h-full w-full" />
                    </Tile>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Chưa có nền nào.</p>
              )}
              <Link href="/student/shop?tab=background" className="mt-3 inline-block text-sm text-primary hover:underline">
                Mua thêm nền ở Cửa hàng →
              </Link>
            </Section>

            <Section title="Khung avatar">
              <div className="grid grid-cols-3 gap-2.5">
                <FrameTile label="Không khung" active={draft.equippedFrame === null} onSelect={() => patch({ equippedFrame: null })}>
                  <StudentAvatar
                    avatarUrl={draft.avatarUrl}
                    avatarPreset={draft.avatarPreset}
                    userImage={userImage}
                    displayName={draft.displayName || "?"}
                    size="md"
                  />
                </FrameTile>
                {frames.map((item) => (
                  <FrameTile
                    key={item.key}
                    label={item.name}
                    active={draft.equippedFrame === item.key}
                    onSelect={() => patch({ equippedFrame: item.key })}
                  >
                    <StudentAvatar
                      avatarUrl={draft.avatarUrl}
                      avatarPreset={draft.avatarPreset}
                      userImage={userImage}
                      displayName={draft.displayName || "?"}
                      size="md"
                      frame={item.key}
                    />
                  </FrameTile>
                ))}
              </div>
              {frames.length === 0 ? (
                <Link href="/student/shop?tab=frame" className="mt-3 inline-block text-sm text-primary hover:underline">
                  Mua khung ở Cửa hàng →
                </Link>
              ) : null}
            </Section>

            <Section title="Tên hiển thị" counter={`${draft.displayName.length}/${NAME_LIMIT}`}>
              <input
                value={draft.displayName}
                maxLength={NAME_LIMIT}
                onChange={(event) => patch({ displayName: event.target.value })}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
              {draft.displayName.trim().length === 0 ? (
                <p className="mt-1 text-xs text-rose-500">Tên không được để trống.</p>
              ) : null}
            </Section>

            <Section title="Giới thiệu" counter={`${draft.bio.length}/${BIO_LIMIT}`}>
              <textarea
                value={draft.bio}
                maxLength={BIO_LIMIT}
                rows={3}
                onChange={(event) => patch({ bio: event.target.value })}
                placeholder="Vài dòng về bạn…"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
            </Section>

            <Section title="Mục tiêu band">
              <input
                type="number"
                step="0.5"
                min="0"
                max="9"
                inputMode="decimal"
                value={draft.targetBand}
                onChange={(event) => patch({ targetBand: event.target.value })}
                className="w-32 rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
            </Section>
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-border bg-card px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold transition hover:bg-muted"
            >
              Hủy
            </button>
            {uploading || draft.displayName.trim().length === 0 ? (
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground opacity-60"
              >
                {uploading ? "Đang tải ảnh…" : "Lưu thay đổi"}
              </button>
            ) : (
              <ActionSubmitButton className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Lưu thay đổi
              </ActionSubmitButton>
            )}
          </footer>
        </div>
      </ActionForm>
    </div>,
    document.body
  );
}

function Section({ title, counter, children }: { title: string; counter?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {counter ? <span className="text-xs tabular-nums text-muted-foreground">{counter}</span> : null}
      </div>
      {children}
    </section>
  );
}

// Ô chọn file thật ẩn bằng sr-only (thuộc tính hidden thua class Tailwind).
function FilePicker({
  id,
  label,
  disabled,
  onFile
}: {
  id: string;
  label: string;
  disabled: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        id={id}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      <label
        htmlFor={id}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium transition ${
          disabled ? "cursor-wait opacity-60" : "cursor-pointer hover:border-primary hover:text-primary"
        }`}
      >
        <span aria-hidden="true">⤒</span>
        {label}
      </label>
    </>
  );
}

function Tile({
  label,
  active,
  onSelect,
  onRemove,
  children
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
  onRemove?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        aria-pressed={active}
        onClick={onSelect}
        className={`block w-full overflow-hidden rounded-lg border-2 text-left transition ${
          active ? "border-primary" : "border-transparent hover:border-border"
        }`}
      >
        <div className="relative aspect-[16/9] overflow-hidden">{children}</div>
        <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-2 py-1 text-xs font-medium text-white">
          {label}
        </span>
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Xoá ảnh nền của bạn"
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-sm text-white hover:bg-rose-600"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function FrameTile({
  label,
  active,
  onSelect,
  children
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={`flex flex-col items-center gap-2 rounded-lg border-2 px-1 pb-2 pt-4 transition ${
        active ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
      }`}
    >
      {children}
      <span className="w-full truncate text-center text-xs">{label}</span>
    </button>
  );
}
