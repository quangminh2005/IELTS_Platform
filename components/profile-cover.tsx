import { BackgroundArt } from "@/components/shop/background-art";
import { resolveCover } from "@/lib/profile-cover";

// Dải bìa trang hồ sơ: nền mua ở Cửa hàng, ảnh nền tự tải hoặc màu bìa miễn phí —
// thứ tự quyết định nằm ở resolveCover (lib/profile-cover.ts).
export function ProfileCover({
  backgroundKey,
  coverColor,
  coverImageUrl = null,
  className = "h-32",
  heightClassName = "",
  fit = "cover"
}: {
  backgroundKey: string | null;
  coverColor: string | null;
  coverImageUrl?: string | null;
  className?: string;
  // "natural" = khung theo tỉ lệ ảnh, hiện trọn ảnh (bìa trang hồ sơ); "cover" = phủ kín,
  // cắt bớt (dải bìa nhỏ). heightClassName: chiều cao khi bìa KHÔNG phải ảnh (màu, nền vẽ).
  heightClassName?: string;
  fit?: "cover" | "natural";
}) {
  const cover = resolveCover({ equippedBackground: backgroundKey, coverImageUrl, coverColor });

  if (cover.kind === "art") {
    return (
      <BackgroundArt artKey={cover.artKey} className={className} heightClassName={heightClassName} fit={fit} />
    );
  }

  if (cover.kind === "image") {
    // Ảnh Blob do học viên tải — không qua trình tối ưu ảnh của Next.
    if (fit === "natural") {
      // Không biết trước tỉ lệ: ảnh nằm trong dòng chảy (h-auto) để khung cao theo ảnh; chặn
      // ảnh quá dọc (85vh) và quá dẹt (đủ chỗ avatar + tên) — chỉ hai ca hiếm đó mới bị cắt.
      return (
        <div className={`relative overflow-hidden bg-muted ${className}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover.src} alt="" className="block h-auto max-h-[85vh] min-h-[14rem] w-full object-cover" />
        </div>
      );
    }

    return (
      <div className={`relative overflow-hidden bg-muted ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      </div>
    );
  }

  return <div className={`${className} ${heightClassName} ${cover.className}`} />;
}
