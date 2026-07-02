import { Component } from "@/components/ui/loader-1";

/**
 * Loader căn giữa một vùng nội dung — dùng cho `loading.tsx` khi chuyển trang.
 * Nhẹ hơn màn splash toàn trang (không phủ nền đục), chỉ hiện trong vùng đang tải.
 */
export const PageLoader = ({ label = "Đang tải…" }: { label?: string }) => {
  return (
    <div
      className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 text-primary"
      role="status"
      aria-live="polite"
    >
      <Component className="h-20 w-20" />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
};
