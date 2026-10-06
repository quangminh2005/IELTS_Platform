const countFormat = new Intl.NumberFormat("vi-VN");

// "N đang theo dõi · N người theo dõi" dưới tên trên hồ sơ (Mạng xã hội Đợt 2).
export function FollowStats({ following, followers }: { following: number; followers: number }) {
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-semibold tabular-nums text-foreground">{countFormat.format(following)}</span> đang theo dõi
      <span aria-hidden="true"> · </span>
      <span className="font-semibold tabular-nums text-foreground">{countFormat.format(followers)}</span> người theo
      dõi
    </p>
  );
}
