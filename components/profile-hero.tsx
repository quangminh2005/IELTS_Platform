import { ProfileCover } from "@/components/profile-cover";
import { StudentAvatar } from "@/components/student-avatar";

// Banner đầu trang hồ sơ kiểu chin.edu.vn: bìa cao (nền mua ở Cửa hàng hoặc màu bìa
// miễn phí), avatar có khung nằm GIỮA bìa, tên đặt trong nhãn tối để đọc được trên
// mọi nền. Dùng chung cho hồ sơ của mình và hồ sơ bạn cùng lớp.
//
// Cao 224px (điện thoại) / 288px: avatar 96px + khung tràn 18% ≈ 131px, cộng nhãn
// tên vẫn còn chỗ thở. Nền vẽ 800×140 phủ kín (slice) nên bìa cao chỉ lấy khúc giữa —
// chi tiết chính của mọi cảnh đã đặt sẵn ở giữa.
export function ProfileHero({
  backgroundKey,
  coverColor,
  frame,
  avatarUrl,
  avatarPreset,
  userImage,
  displayName
}: {
  backgroundKey: string | null;
  coverColor: string | null;
  frame: string | null;
  avatarUrl: string | null;
  avatarPreset: string | null;
  userImage: string | null;
  displayName: string;
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
        <h2 className="max-w-full truncate rounded-xl bg-black/50 px-4 py-1.5 text-xl font-bold tracking-tight text-white shadow-lg backdrop-blur-sm sm:text-2xl">
          {displayName}
        </h2>
      </div>
    </div>
  );
}
