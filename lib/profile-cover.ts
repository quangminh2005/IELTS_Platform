import { resolveItem } from "@/lib/shop-catalog";
import { coverClassName, isOwnBlobFileIn } from "@/lib/student-avatar";

// Bìa hồ sơ học viên — MỘT nguồn quyết định bìa hiện gì (trang hồ sơ, hồ sơ bạn
// cùng lớp, khối Xu phía giáo viên, bản xem trước trong bảng chỉnh sửa).
//
// Module thuần: không Prisma, không React.

// Giá trị đặc biệt của StudentProfile.equippedBackground: "dùng ảnh nền tự tải".
// Không phải mã Cửa hàng nên resolveItem() trả null — Cửa hàng coi như chưa trang
// bị nền nào, đúng ý.
export const CUSTOM_COVER_KEY = "custom:image";

// Ảnh nền chỉ được nằm trong thư mục covers/ của Blob store mình — cùng chốt với
// avatar (xem isOwnBlobFileIn): deleteOldCover() xoá file cũ, nên URL lạ lọt vào
// là có thể xoá nhầm audio Listening.
export function isAllowedCoverUrl(url: string): boolean {
  return isOwnBlobFileIn(url, "covers");
}

export type CoverSource =
  | { kind: "art"; artKey: string }
  | { kind: "image"; src: string }
  | { kind: "color"; className: string };

// Thứ tự: nền Cửa hàng → ảnh tự tải (khi đang chọn nó) → màu bìa miễn phí.
export function resolveCover(input: {
  equippedBackground: string | null;
  coverImageUrl: string | null;
  coverColor: string | null;
}): CoverSource {
  const item = resolveItem(input.equippedBackground);
  if (item?.category === "background") {
    return { kind: "art", artKey: item.artKey };
  }

  if (
    input.equippedBackground === CUSTOM_COVER_KEY &&
    input.coverImageUrl &&
    isAllowedCoverUrl(input.coverImageUrl)
  ) {
    return { kind: "image", src: input.coverImageUrl };
  }

  return { kind: "color", className: coverClassName(input.coverColor) };
}
