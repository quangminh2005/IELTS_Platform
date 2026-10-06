"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { toggleFollow } from "@/lib/actions/social";

const NETWORK_FAIL = { ok: false, message: "Không kết nối được, thử lại sau nhé." };

// Nút Theo dõi / Đang theo dõi (Mạng xã hội Đợt 2). Đổi trạng thái ngay khi bấm,
// server báo lỗi thì quay lại như cũ.
//
// Bỏ theo dõi cần "lên cò" trước: rê CHUỘT vào (pointerType mouse) hoặc chạm/bấm lần
// đầu thì nút đổi thành "Bỏ theo dõi", bấm thêm lần nữa mới bỏ. Không lên cò bằng
// focus/mouseenter — trên điện thoại một lần chạm bắn cả hai sự kiện đó trước click,
// em nào lỡ tay chạm là mất theo dõi ngay.
export function FollowButton({
  targetId,
  initialFollowing,
  size = "md",
  onChange
}: {
  targetId: string;
  initialFollowing: boolean;
  size?: "md" | "sm";
  onChange?: (following: boolean) => void;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const { notify } = useToast();

  function handleClick() {
    if (following && !armed) {
      setArmed(true);
      return;
    }

    const previous = following;
    const next = !previous;
    setFollowing(next);
    setArmed(false);
    onChange?.(next);

    startTransition(async () => {
      try {
        const result = await toggleFollow(targetId);
        if (!result.ok) {
          setFollowing(previous);
          onChange?.(previous);
          notify(result);
        } else if (typeof result.following === "boolean" && result.following !== next) {
          setFollowing(result.following);
          onChange?.(result.following);
        }
      } catch {
        setFollowing(previous);
        onChange?.(previous);
        notify(NETWORK_FAIL);
      }
    });
  }

  const sizing = size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-2 text-sm";
  const look = following
    ? armed
      ? "border border-red-300 bg-red-50 text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
      : "border border-border bg-card text-foreground"
    : "border border-primary bg-primary text-primary-foreground hover:bg-primary/90";

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setArmed(true);
      }}
      // Cảm ứng bắn pointerleave ngay TRƯỚC click → chỉ tắt cò khi là chuột thật.
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setArmed(false);
      }}
      onBlur={() => setArmed(false)}
      disabled={pending}
      aria-pressed={following}
      className={`shrink-0 rounded-lg font-semibold transition disabled:cursor-wait disabled:opacity-70 ${sizing} ${look}`}
    >
      {following ? (armed ? "Bỏ theo dõi" : "Đang theo dõi ✓") : "Theo dõi"}
    </button>
  );
}
