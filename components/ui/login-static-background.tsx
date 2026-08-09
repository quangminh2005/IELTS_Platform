import { cn } from "@/lib/utils";

// Nền tĩnh của trang đăng nhập. Vừa là lớp lót lúc chunk shader đang tải,
// vừa là đích rơi khi máy tắt hiệu ứng chuyển động hoặc không có WebGL.
// Màu lấy từ --body-radial trong app/globals.css nên tự đổi theo theme.
export function LoginStaticBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{ background: "var(--body-radial)" }}
    />
  );
}
