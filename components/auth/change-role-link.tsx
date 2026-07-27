"use client";

import { useRouter } from "next/navigation";
import { clearPreferredRole } from "@/lib/auth-preferences";

// Quên vai trò đã ghi nhớ rồi quay lại trang chọn — dùng cho máy dùng chung.
export function ChangeRoleLink() {
  const router = useRouter();

  return (
    <p className="mt-6 text-center text-xs text-muted-foreground">
      Không phải bạn?{" "}
      <button
        className="font-semibold text-primary underline-offset-2 transition hover:underline"
        type="button"
        onClick={() => {
          clearPreferredRole();
          router.push("/login");
        }}
      >
        Đổi vai trò
      </button>
    </p>
  );
}
