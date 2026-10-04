import { ProfileCover } from "@/components/profile-cover";
import { EquippedMascot } from "@/components/shop/mascot-art";
import { StudentAvatar } from "@/components/student-avatar";

// Banner đầu trang hồ sơ kiểu chin.edu.vn: bìa cao (nền mua ở Cửa hàng hoặc màu bìa
// miễn phí), avatar có khung nằm GIỮA bìa, tên đặt trong nhãn tối để đọc được trên
// mọi nền. Dùng chung cho hồ sơ của mình và hồ sơ bạn cùng lớp.
//
// Cao 224px (điện thoại) / 288px: avatar 96px + khung tràn 18% ≈ 131px, cộng nhãn
// tên vẫn còn chỗ thở. Nền vẽ 800×140 phủ kín (slice) nên bìa cao chỉ lấy khúc giữa —
// chi tiết chính của mọi cảnh đã đặt sẵn ở giữa.
// Linh vật (Đợt 4) đứng ở góc phải dưới bìa; có linh vật thì nhãn tên trên điện thoại
// hẹp lại để không đè lên nó.
export function ProfileHero({
  backgroundKey,
  coverColor,
  frame,
  avatarUrl,
  avatarPreset,
  userImage,
  displayName,
  mascotKey = null
}: {
  backgroundKey: string | null;
  coverColor: string | null;
  frame: string | null;
  avatarUrl: string | null;
  avatarPreset: string | null;
  userImage: string | null;
  displayName: string;
  mascotKey?: string | null;
}) {
  return (
    <div className="relative">
      <ProfileCover backgroundKey={backgroundKey} coverColor={coverColor} className="h-56 sm:h-72" />
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
    </div>
  );
}
