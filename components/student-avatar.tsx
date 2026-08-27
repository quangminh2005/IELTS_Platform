import { resolveStudentAvatar } from "@/lib/student-avatar";

// Component hiện avatar dùng chung cho MỌI nơi: thanh điều hướng, bảng xếp hạng,
// trang giáo viên, báo cáo phụ huynh. Đừng vẽ avatar bằng tay ở chỗ khác.

const SIZES = {
  sm: { box: "h-8 w-8", text: "text-xs", emoji: "text-base" },
  md: { box: "h-12 w-12", text: "text-sm", emoji: "text-xl" },
  lg: { box: "h-16 w-16", text: "text-lg", emoji: "text-2xl" },
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
      // biến đổi ảnh.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={source.src}
        alt={`Ảnh đại diện của ${displayName}`}
        className={shared}
        loading="lazy"
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
