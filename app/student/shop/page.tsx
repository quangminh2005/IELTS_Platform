import Link from "next/link";
import { redirect } from "next/navigation";
import { BackgroundArt } from "@/components/shop/background-art";
import { FrameArt } from "@/components/shop/frame-art";
import { ShopItemCard, type ShopCardState } from "@/components/shop/shop-item-card";
import { StudentAvatar } from "@/components/student-avatar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ACHIEVEMENT_TEMPLATES,
  RARITY_LABELS,
  RARITY_ORDER,
  SHOP_ITEMS,
  resolveItem,
  type ItemCategory,
  type ItemRarity,
  type ResolvedItem
} from "@/lib/shop-catalog";
import { syncWallet } from "@/lib/wallet";

export const dynamic = "force-dynamic";

const numberFormat = new Intl.NumberFormat("vi-VN");
const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh"
});

type Tab = ItemCategory | "history";

const TABS: { key: Tab; label: string }[] = [
  { key: "background", label: "Nền" },
  { key: "frame", label: "Khung" },
  { key: "history", label: "Lịch sử Xu" }
];

function parseTab(raw: string | undefined): Tab {
  return raw === "frame" || raw === "history" ? raw : "background";
}

function parseRarity(raw: string | undefined): ItemRarity | null {
  return RARITY_ORDER.find((rarity) => rarity === raw) ?? null;
}

function shopHref(tab: Tab, rarity: ItemRarity | null): string {
  const params = new URLSearchParams({ tab });
  if (rarity) params.set("rarity", rarity);
  return `/student/shop?${params.toString()}`;
}

// Một thẻ trên lưới: món thật (có mã) hoặc thẻ mẫu khoá của đồ thành tích chưa có.
type Card = {
  item: ResolvedItem;
  state: ShopCardState;
};

export default async function StudentShopPage({
  searchParams
}: {
  searchParams?: { tab?: string; rarity?: string };
}) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "student") {
    redirect("/login");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });

  if (!student) {
    redirect("/waiting");
  }

  // Lưới an toàn: bù mọi khoản Xu còn sót (lỡ móc nộp bài lỗi) + cấp đồ thành tích
  // tháng mới khép. Lỗi ở đây không được làm sập Cửa hàng.
  try {
    await syncWallet(student.id);
  } catch (error) {
    console.error("[wallet] đồng bộ ở Cửa hàng lỗi", error);
  }

  const tab = parseTab(searchParams?.tab);
  const rarityFilter = tab === "history" ? null : parseRarity(searchParams?.rarity);

  const [profile, ownedRows, transactions] = await Promise.all([
    prisma.studentProfile.findUniqueOrThrow({
      where: { id: student.id },
      select: {
        coins: true,
        displayName: true,
        avatarUrl: true,
        avatarPreset: true,
        equippedBackground: true,
        equippedFrame: true,
        user: { select: { image: true } }
      }
    }),
    prisma.studentItem.findMany({ where: { studentId: student.id }, select: { itemKey: true } }),
    tab === "history"
      ? prisma.coinTransaction.findMany({
          where: { studentId: student.id },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: { id: true, amount: true, note: true, createdAt: true }
        })
      : Promise.resolve([])
  ]);

  const owned = new Set(ownedRows.map((row) => row.itemKey));
  const coins = profile.coins;

  function cardsFor(category: ItemCategory): Card[] {
    const equipped = category === "background" ? profile.equippedBackground : profile.equippedFrame;
    const cards: Card[] = [];

    for (const catalogItem of SHOP_ITEMS) {
      if (catalogItem.category !== category) continue;
      const item = resolveItem(catalogItem.key);
      if (!item) continue;
      const price = item.price ?? 0;
      const state: ShopCardState =
        equipped === item.key
          ? "equipped"
          : owned.has(item.key)
            ? "owned"
            : coins >= price
              ? "buyable"
              : "short";
      cards.push({ item, state });
    }

    for (const template of ACHIEVEMENT_TEMPLATES) {
      if (template.category !== category) continue;
      const mine = Array.from(owned)
        .map((key) => resolveItem(key))
        .filter((item): item is ResolvedItem => item?.artKey === template.baseKey)
        .sort((a, b) => (a.monthKey ?? "").localeCompare(b.monthKey ?? ""));

      if (mine.length === 0) {
        // Chưa có tháng nào → một thẻ mẫu khoá, nói cách mở.
        cards.push({
          item: {
            key: template.baseKey,
            name: template.namePrefix,
            category: template.category,
            rarity: "achievement",
            price: null,
            description: template.description,
            artKey: template.baseKey,
            monthKey: null
          },
          state: "locked"
        });
      } else {
        for (const item of mine) {
          cards.push({ item, state: equipped === item.key ? "equipped" : "owned" });
        }
      }
    }

    return cards
      .filter((card) => !rarityFilter || card.item.rarity === rarityFilter)
      .sort(
        (a, b) =>
          RARITY_ORDER.indexOf(a.item.rarity) - RARITY_ORDER.indexOf(b.item.rarity) ||
          (a.item.price ?? 0) - (b.item.price ?? 0)
      );
  }

  function preview(item: ResolvedItem) {
    if (item.category === "background") {
      return <BackgroundArt artKey={item.artKey} className="aspect-[5/2] w-full" />;
    }
    // Xem thử khung ngay quanh avatar của chính học viên. Vẽ thẳng theo artKey vì
    // thẻ mẫu đồ thành tích (chưa có tháng nào) không có mã món thật.
    return (
      <div className="flex h-32 w-full items-center justify-center bg-muted/40">
        <span className="relative inline-flex h-16 w-16 shrink-0 rounded-full">
          <StudentAvatar
            avatarUrl={profile.avatarUrl}
            avatarPreset={profile.avatarPreset}
            userImage={profile.user?.image ?? null}
            displayName={profile.displayName}
            size="lg"
          />
          <FrameArt
            artKey={item.artKey}
            className="pointer-events-none absolute -inset-[18%] h-[136%] w-[136%]"
          />
        </span>
      </div>
    );
  }

  const linkBase = "rounded-lg px-3 py-2 text-sm font-semibold transition";

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Số dư</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-amber-600 dark:text-amber-300">
            🪙 {numberFormat.format(coins)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Kiếm Xu bằng cách nộp bài (lượt đầu) và ôn Sổ từ mỗi ngày.
          </p>
        </div>

        <nav className="flex gap-2 lg:flex-col" aria-label="Mục Cửa hàng">
          {TABS.map((item) => (
            <Link
              key={item.key}
              href={shopHref(item.key, null)}
              className={`${linkBase} ${
                tab === item.key
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-foreground hover:border-primary hover:text-primary"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {tab !== "history" ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Độ hiếm</p>
            <div className="flex flex-wrap gap-1.5">
              {[null, ...RARITY_ORDER].map((rarity) => (
                <Link
                  key={rarity ?? "all"}
                  href={shopHref(tab, rarity)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    rarityFilter === rarity
                      ? "bg-foreground text-background"
                      : "border border-border bg-card hover:border-primary hover:text-primary"
                  }`}
                >
                  {rarity ? RARITY_LABELS[rarity] : "Tất cả"}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <Link href="/student/profile" className="block text-sm text-primary hover:underline">
          ← Về hồ sơ của tôi
        </Link>
      </aside>

      <section className="min-w-0">
        <h2 className="text-xl font-bold tracking-tight">
          {TABS.find((item) => item.key === tab)?.label}
        </h2>

        {tab === "history" ? (
          transactions.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Chưa có giao dịch nào — làm bài đầu tiên để nhận Xu nhé!
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-card shadow-card">
              {transactions.map((row) => (
                <li key={row.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={`w-16 shrink-0 text-right text-sm font-bold tabular-nums ${
                      row.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {row.amount >= 0 ? "+" : "−"}
                    {numberFormat.format(Math.abs(row.amount))}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{row.note ?? "—"}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{dateFormat.format(row.createdAt)}</span>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {cardsFor(tab).map(({ item, state }) => (
              <ShopItemCard
                key={`${item.key}-${state}`}
                itemKey={item.key}
                name={item.name}
                category={item.category}
                rarity={item.rarity}
                rarityLabel={RARITY_LABELS[item.rarity]}
                price={item.price}
                description={item.description}
                coins={coins}
                state={state}
                preview={preview(item)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
