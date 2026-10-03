import { ProfileCover } from "@/components/profile-cover";
import { resolveItem } from "@/lib/shop-catalog";

const numberFormat = new Intl.NumberFormat("vi-VN");
const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh"
});

// Khối "Xu & đồ trang trí" ở trang học viên phía giáo viên. Chỉ xem — thầy không
// cộng/trừ Xu tay ở Đợt 1.
export function StudentWalletSummary({
  coins,
  equippedBackground,
  equippedFrame,
  coverColor,
  itemKeys,
  transactions
}: {
  coins: number;
  equippedBackground: string | null;
  equippedFrame: string | null;
  coverColor: string | null;
  itemKeys: string[];
  transactions: { id: string; amount: number; note: string | null; createdAt: Date }[];
}) {
  const items = itemKeys
    .map((key) => resolveItem(key))
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Xu & đồ trang trí</h3>
        <p className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-300">
          🪙 {numberFormat.format(coins)} Xu
        </p>
      </div>

      <ProfileCover
        backgroundKey={equippedBackground}
        coverColor={coverColor}
        className="mt-3 h-20 rounded-lg"
      />

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
