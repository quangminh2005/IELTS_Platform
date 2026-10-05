"use client";

import { useCallback, useState } from "react";
import type { ServerAction } from "@/components/action-form";
import { ProfileEditDrawer, type ProfileDraft } from "@/components/profile-edit-drawer";
import { ProfileHero } from "@/components/profile-hero";

// Bìa hồ sơ CỦA MÌNH: nút bút chì mở bảng "Chỉnh sửa hồ sơ" (kiểu chin.edu.vn).
// Trong lúc bảng mở, bìa hiện theo BẢN NHÁP để học viên thấy ngay kết quả; Hủy thì
// bỏ nháp, bìa quay về bản đã lưu (props `saved` — server dựng lại sau khi lưu).
export function MyProfileHero({
  action,
  saved,
  userImage,
  ownedBackgroundKeys,
  ownedFrameKeys
}: {
  action: ServerAction;
  saved: ProfileDraft;
  userImage: string | null;
  ownedBackgroundKeys: string[];
  ownedFrameKeys: string[];
}) {
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const shown = draft ?? saved;
  const close = useCallback(() => setDraft(null), []);

  return (
    <>
      <ProfileHero
        backgroundKey={shown.equippedBackground}
        coverColor={shown.coverColor}
        coverImageUrl={shown.coverImageUrl}
        frame={shown.equippedFrame}
        avatarUrl={shown.avatarUrl}
        avatarPreset={shown.avatarPreset}
        userImage={userImage}
        displayName={shown.displayName.trim() || saved.displayName}
        action={
          <button
            type="button"
            onClick={() => setDraft(saved)}
            aria-label="Chỉnh sửa hồ sơ"
            title="Chỉnh sửa hồ sơ"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/65"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16v4Z" strokeLinejoin="round" />
              <path d="m13.5 6.5 4 4" />
            </svg>
          </button>
        }
      />
      {draft ? (
        <ProfileEditDrawer
          action={action}
          draft={draft}
          onChange={setDraft}
          onClose={close}
          userImage={userImage}
          ownedBackgroundKeys={ownedBackgroundKeys}
          ownedFrameKeys={ownedFrameKeys}
        />
      ) : null}
    </>
  );
}
