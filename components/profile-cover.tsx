import { BackgroundArt } from "@/components/shop/background-art";
import { resolveItem } from "@/lib/shop-catalog";
import { coverClassName } from "@/lib/student-avatar";

// Dải bìa trang hồ sơ: nền mua ở Cửa hàng nếu đang trang bị, không thì màu bìa
// miễn phí như cũ.
export function ProfileCover({
  backgroundKey,
  coverColor,
  className = "h-32"
}: {
  backgroundKey: string | null;
  coverColor: string | null;
  className?: string;
}) {
  const item = resolveItem(backgroundKey);

  if (item?.category === "background") {
    return <BackgroundArt artKey={item.artKey} className={className} />;
  }

  return <div className={`${className} ${coverClassName(coverColor)}`} />;
}
