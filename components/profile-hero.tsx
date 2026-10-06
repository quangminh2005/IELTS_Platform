import type { ReactNode } from "react";
import { ProfileCover } from "@/components/profile-cover";
import { EquippedMascot } from "@/components/shop/mascot-art";
import { StudentAvatar } from "@/components/student-avatar";

// Banner đầu trang hồ sơ kiểu chin.edu.vn: bìa cao (nền mua ở Cửa hàng, ảnh nền tự
// tải hoặc màu bìa), avatar có khung nằm GIỮA bìa, tên đặt trong nhãn tối để đọc
// được trên mọi nền. Dùng chung cho hồ sơ của mình và hồ sơ bạn cùng lớp.
//
// Tranh/ảnh nền (fit="natural"): bìa cao theo tỉ lệ ảnh, tối đa 384px — điện thoại thấy
// trọn tranh, máy tính phủ kín và cắt nhẹ mép trên/dưới.
// Bìa màu/nền vẽ thì cao 224px (điện thoại) / 384px: avatar 96px + khung tràn 18% ≈ 131px,
// cộng nhãn tên vẫn còn chỗ thở.
// Linh vật: hai trang hồ sơ đặt nó ở thẻ riêng cột phải (bố cục 2 cột 5/10/2026),
// nên mascotKey giờ là tuỳ chọn; có linh vật thì nhãn tên hẹp lại để không đè lên nó.
// `action` = nút góc phải trên (bút chì mở bảng chỉnh sửa ở hồ sơ của mình).
export function ProfileHero({
  backgroundKey,
  coverColor,
  coverImageUrl = null,
  frame,
  avatarUrl,
  avatarPreset,
  userImage,
  displayName,
  mascotKey = null,
  action = null
}: {
  backgroundKey: string | null;
  coverColor: string | null;
  coverImageUrl?: string | null;
  frame: string | null;
  avatarUrl: string | null;
  avatarPreset: string | null;
  userImage: string | null;
  displayName: string;
  mascotKey?: string | null;
  action?: ReactNode;
}) {
  return (
    <div className="relative">
      <ProfileCover
        backgroundKey={backgroundKey}
        coverColor={coverColor}
        coverImageUrl={coverImageUrl}
        className=""
        heightClassName="h-56 sm:h-96"
        fit="natural"
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4">
        <StudentAvatar
          avatarUrl={avatarUrl}
          avatarPreset={avatarPreset}
          userImage={userImage}
          displayName={displayName}
          size="xl"
          className="ring-4 ring-white/80"
          frame={frame}
        />
        <h2
          className={`${mascotKey ? "max-w-[66%] sm:max-w-[64%]" : "max-w-full"} truncate rounded-xl bg-black/50 px-4 py-1.5 text-xl font-bold tracking-tight text-white shadow-lg backdrop-blur-sm sm:text-2xl`}
        >
          {displayName}
        </h2>
      </div>
      <EquippedMascot
        poseKey={mascotKey}
        className="pointer-events-none absolute bottom-1 right-0 h-20 w-20 drop-shadow-lg sm:bottom-2 sm:right-6 sm:h-40 sm:w-40"
      />
      {action ? <div className="absolute right-3 top-3">{action}</div> : null}
    </div>
  );
}
