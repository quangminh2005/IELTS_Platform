import { resolveStudentAvatar } from "@/lib/student-avatar";

// Component hiện avatar dùng chung cho MỌI nơi: thanh điều hướng, bảng xếp hạng,
// trang giáo viên, báo cáo phụ huynh. Đừng vẽ avatar bằng tay ở chỗ khác.

const SIZES = {
  sm: { box: "h-8 w-8", text: "text-xs", emoji: "text-base" },
  // "list": kích thước avatar ở các hàng danh sách (bảng xếp hạng từ hạng 4 trở
  // đi, nhóm "chưa có bài nào") — giữ đúng 36px như giao diện gốc, KHÔNG dùng
  // "md" (48px) cho các hàng này vì sẽ to hơn hẳn so với trước.
  list: { box: "h-9 w-9", text: "text-xs", emoji: "text-base" },
  md: { box: "h-12 w-12", text: "text-sm", emoji: "text-xl" },
  lg: { box: "h-16 w-16", text: "text-lg", emoji: "text-2xl" },
  // "podium": riêng cho avatar hạng nhất trên bục — 80px, lớn hơn hạng nhì/ba
  // (dùng "lg" = 64px) một bậc để nổi bật, đúng như giao diện gốc.
  podium: { box: "h-20 w-20", text: "text-xl", emoji: "text-3xl" },
  xl: { box: "h-24 w-24", text: "text-2xl", emoji: "text-4xl" }
} as const;

export function StudentAvatar({
  avatarUrl,
  avatarPreset,
  userImage,
  displayName,
  size = "md",
  className = ""
}: {
  avatarUrl: string | null;
  avatarPreset: string | null;
  userImage: string | null;
  displayName: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const source = resolveStudentAvatar({
    avatarUrl,
    avatarPreset,
    userImage,
    displayName
  });
  const dimension = SIZES[size];
  const shared = `${dimension.box} shrink-0 rounded-full object-cover ${className}`;

  if (source.kind === "image") {
    return (
      // Ảnh từ Blob/Google, không qua trình tối ưu ảnh của Next để khỏi tốn hạn mức
      // biến đổi ảnh. referrerPolicy="no-referrer": không gửi Referer tới Google
      // khi ảnh là ảnh Google Account — thiếu dòng này một số tài khoản sẽ không
      // tải được ảnh (quy ước đã dùng ở app/(auth)/login/student/page.tsx).
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={source.src}
        alt={`Ảnh đại diện của ${displayName}`}
        className={shared}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }

  const content = source.kind === "preset" ? source.emoji : source.text;
  const contentClass = source.kind === "preset" ? dimension.emoji : dimension.text;

  return (
    <span
      aria-label={`Ảnh đại diện của ${displayName}`}
      role="img"
      className={`${dimension.box} shrink-0 rounded-full ${source.colorClass} ${className} inline-flex items-center justify-center font-bold text-white`}
    >
      <span className={contentClass}>{content}</span>
    </span>
  );
}
