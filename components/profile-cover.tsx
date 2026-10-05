import { BackgroundArt } from "@/components/shop/background-art";
import { resolveCover } from "@/lib/profile-cover";

// Dải bìa trang hồ sơ: nền mua ở Cửa hàng, ảnh nền tự tải hoặc màu bìa miễn phí —
// thứ tự quyết định nằm ở resolveCover (lib/profile-cover.ts).
export function ProfileCover({
  backgroundKey,
  coverColor,
  coverImageUrl = null,
  className = "h-32"
}: {
  backgroundKey: string | null;
  coverColor: string | null;
  coverImageUrl?: string | null;
  className?: string;
}) {
  const cover = resolveCover({ equippedBackground: backgroundKey, coverImageUrl, coverColor });

  if (cover.kind === "art") {
    return <BackgroundArt artKey={cover.artKey} className={className} />;
  }

  if (cover.kind === "image") {
    return (
      <div className={`relative overflow-hidden bg-muted ${className}`}>
        {/* Ảnh Blob do học viên tải — không qua trình tối ưu ảnh của Next. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      </div>
    );
  }

  return <div className={`${className} ${cover.className}`} />;
}
