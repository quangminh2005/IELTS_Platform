import { FrameArt } from "@/components/shop/frame-art";
import { resolveItem } from "@/lib/shop-catalog";
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
  // Chữ viết tắt giữ "text-lg" y hệt hạng nhì/ba: giao diện gốc dùng chung một cỡ
  // chữ cho cả ba bục dù khung hạng nhất to hơn. Đổi sang text-xl là làm khác bản cũ.
  podium: { box: "h-20 w-20", text: "text-lg", emoji: "text-2xl" },
  xl: { box: "h-24 w-24", text: "text-2xl", emoji: "text-4xl" }
} as const;

export function StudentAvatar({
  avatarUrl,
  avatarPreset,
  userImage,
  displayName,
  size = "md",
  className = "",
  frame = null
}: {
  avatarUrl: string | null;
  avatarPreset: string | null;
  userImage: string | null;
  displayName: string;
  size?: keyof typeof SIZES;
  className?: string;
  // Mã khung avatar đang trang bị (lib/shop-catalog.ts). Mã lạ / không phải khung → bỏ.
  frame?: string | null;
}) {
  const source = resolveStudentAvatar({
    avatarUrl,
    avatarPreset,
    userImage,
    displayName
  });
  const dimension = SIZES[size];
  const shared = `${dimension.box} shrink-0 rounded-full object-cover ${className}`;

  let avatar: JSX.Element;

  if (source.kind === "image") {
    avatar = (
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
  } else {
    const content = source.kind === "preset" ? source.emoji : source.text;
    const contentClass = source.kind === "preset" ? dimension.emoji : dimension.text;

    avatar = (
      <span
        aria-label={`Ảnh đại diện của ${displayName}`}
        role="img"
        className={`${dimension.box} shrink-0 rounded-full ${source.colorClass} ${className} inline-flex items-center justify-center font-bold text-white`}
      >
        <span className={contentClass}>{content}</span>
      </span>
    );
  }

  const frameItem = resolveItem(frame);

  if (!frameItem || frameItem.category !== "frame") {
    return avatar;
  }

  // Khung tràn ra ngoài hộp avatar bằng định vị tuyệt đối → kích thước hộp giữ
  // nguyên, hàng danh sách / bục xếp hạng không bị xô lệch.
  return (
    <span className={`relative inline-flex shrink-0 rounded-full ${dimension.box}`}>
      {avatar}
      <FrameArt
        artKey={frameItem.artKey}
        // Avatar nhỏ ở danh sách: bỏ tia sao/tàn lửa/quầng sáng cho đỡ rối mắt.
        lite={size === "sm" || size === "list"}
        className="pointer-events-none absolute -inset-[18%] h-[136%] w-[136%]"
      />
    </span>
  );
}
