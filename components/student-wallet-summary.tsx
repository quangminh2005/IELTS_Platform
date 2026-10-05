import { ActionDeleteButton, ActionForm } from "@/components/action-form";
import { ProfileCover } from "@/components/profile-cover";
import { removeStudentCoverImage } from "@/lib/actions/profile";
import { CUSTOM_COVER_KEY } from "@/lib/profile-cover";
import { EquippedMascot } from "@/components/shop/mascot-art";
import { MASCOTS, mascotKey } from "@/lib/mascots";
import { resolveItem } from "@/lib/shop-catalog";

const numberFormat = new Intl.NumberFormat("vi-VN");
const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh"
});

// Khối "Xu & đồ trang trí" ở trang học viên phía giáo viên. Chỉ xem — thầy không
// cộng/trừ Xu tay ở Đợt 1. Ngoại lệ duy nhất: gỡ ảnh nền học viên tự tải nếu ảnh
// không phù hợp (bạn cùng lớp nhìn thấy ảnh này ở trang hồ sơ).
export function StudentWalletSummary({
  studentId,
  coins,
  equippedBackground,
  equippedFrame,
  equippedMascot,
  coverColor,
  coverImageUrl,
  itemKeys,
  transactions
}: {
  studentId: string;
  coins: number;
  equippedBackground: string | null;
  equippedFrame: string | null;
  equippedMascot: string | null;
  coverColor: string | null;
  coverImageUrl: string | null;
  itemKeys: string[];
  transactions: { id: string; amount: number; note: string | null; createdAt: Date }[];
}) {
  const items = itemKeys
    .map((key) => resolveItem(key))
    .filter((item): item is NonNullable<typeof item> => item !== null);
  // Linh vật: tên con + số tư thế đã có ("Đứng yên" đi kèm con).
  const mascots = MASCOTS.filter((mascot) => itemKeys.includes(mascotKey(mascot.id))).map((mascot) => ({
    name: mascot.name,
    poses: 1 + itemKeys.filter((key) => key.startsWith(`pose:${mascot.id}:`)).length
  }));

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Xu & đồ trang trí</h3>
        <p className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-300">
          🪙 {numberFormat.format(coins)} Xu
        </p>
      </div>

      <div className="relative mt-3">
        <ProfileCover
          backgroundKey={equippedBackground}
          coverColor={coverColor}
          coverImageUrl={coverImageUrl}
          className="h-20 rounded-lg"
        />
        <EquippedMascot poseKey={equippedMascot} className="absolute bottom-0 right-2 h-20 w-20" />
      </div>

      {coverImageUrl ? (
        <ActionForm action={removeStudentCoverImage} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <input type="hidden" name="studentId" value={studentId} />
          <span className="text-muted-foreground">
            Học viên có ảnh nền tự tải
            {equippedBackground === CUSTOM_COVER_KEY ? " (đang dùng)" : ""}.{" "}
            <a href={coverImageUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              Xem ảnh
            </a>
          </span>
          <ActionDeleteButton
            action={removeStudentCoverImage}
            confirmMessage="Gỡ ảnh nền này? Ảnh bị xoá hẳn, bìa của học viên quay về màu bìa."
            className="rounded-lg border border-rose-300 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950"
          >
            Gỡ ảnh nền
          </ActionDeleteButton>
        </ActionForm>
      ) : null}

      <p className="mt-3 text-sm">
        <span className="font-medium">Đồ đang có: </span>
        {items.length === 0 ? (
          <span className="text-muted-foreground">chưa có món nào</span>
        ) : (
          items.map((item, index) => (
            <span key={item.key}>
              {index > 0 ? ", " : ""}
              {item.name}
              {item.key === equippedBackground || item.key === equippedFrame ? (
                <span className="text-primary"> (đang dùng)</span>
              ) : null}
            </span>
          ))
        )}
      </p>
      {mascots.length > 0 ? (
        <p className="mt-1 text-sm">
          <span className="font-medium">Linh vật: </span>
          {mascots.map((mascot) => `${mascot.name} (${mascot.poses} tư thế)`).join(", ")}
        </p>
      ) : null}

      {transactions.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-primary">
            {transactions.length} giao dịch gần nhất
          </summary>
          <ul className="mt-2 divide-y divide-border text-sm">
            {transactions.map((row) => (
              <li key={row.id} className="flex items-center gap-3 py-2">
                <span
                  className={`w-14 shrink-0 text-right font-bold tabular-nums ${
                    row.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {row.amount >= 0 ? "+" : "−"}
                  {numberFormat.format(Math.abs(row.amount))}
                </span>
                <span className="min-w-0 flex-1 truncate">{row.note ?? "—"}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{dateFormat.format(row.createdAt)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
