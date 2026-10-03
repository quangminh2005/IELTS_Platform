import { isMonthKey, monthKeyOf, shiftMonthKey, type MonthlyRecap } from "@/lib/monthly-recap";

// Danh mục đồ trang trí của Cửa hàng. Hình vẽ nằm ở components/shop/*-art.tsx
// theo artKey — thêm đồ = thêm một dòng ở đây + một hình ở đó (test ép đủ cặp).

export type ItemCategory = "background" | "frame";
export type ItemRarity = "common" | "rare" | "epic" | "legendary" | "achievement";

export type CatalogItem = {
  key: string;
  name: string;
  category: ItemCategory;
  rarity: ItemRarity;
  price: number | null; // null = không bán (đồ thành tích)
  description?: string;
};

export type ResolvedItem = CatalogItem & { artKey: string; monthKey: string | null };

export const RARITY_ORDER: ItemRarity[] = ["common", "rare", "epic", "legendary", "achievement"];

export const RARITY_LABELS: Record<ItemRarity, string> = {
  common: "Thường",
  rare: "Hiếm",
  epic: "Sử thi",
  legendary: "Huyền thoại",
  achievement: "Thành tích"
};

export const SHOP_ITEMS: CatalogItem[] = [
  { key: "bg:starry-night", name: "Trời sao", category: "background", rarity: "common", price: 150 },
  { key: "bg:meadow", name: "Đồng cỏ", category: "background", rarity: "common", price: 150 },
  { key: "bg:ocean", name: "Sóng biển", category: "background", rarity: "common", price: 150 },
  { key: "bg:pink-clouds", name: "Mây hồng", category: "background", rarity: "common", price: 150 },
  { key: "bg:sunset", name: "Hoàng hôn", category: "background", rarity: "rare", price: 500 },
  { key: "bg:bamboo", name: "Rừng tre", category: "background", rarity: "rare", price: 500 },
  { key: "bg:city-night", name: "Thành phố đêm", category: "background", rarity: "rare", price: 500 },
  { key: "bg:aurora", name: "Cực quang", category: "background", rarity: "epic", price: 1200 },
  { key: "bg:snow-peaks", name: "Núi tuyết", category: "background", rarity: "epic", price: 1200 },
  { key: "bg:old-library", name: "Thư viện cổ", category: "background", rarity: "epic", price: 1200 },
  { key: "bg:galaxy", name: "Thiên hà", category: "background", rarity: "legendary", price: 3000 },
  { key: "frame:wood", name: "Khung gỗ", category: "frame", rarity: "common", price: 200 },
  { key: "frame:bronze", name: "Khung đồng", category: "frame", rarity: "common", price: 300 },
  { key: "frame:silver", name: "Khung bạc", category: "frame", rarity: "rare", price: 700 },
  { key: "frame:gold", name: "Khung vàng", category: "frame", rarity: "rare", price: 1000 },
  { key: "frame:emerald", name: "Ngọc lục bảo", category: "frame", rarity: "epic", price: 1500 },
  { key: "frame:ruby", name: "Hồng ngọc", category: "frame", rarity: "epic", price: 2000 },
  { key: "frame:phoenix", name: "Phượng hoàng lửa", category: "frame", rarity: "legendary", price: 3500 }
];

export type AchievementTemplate = {
  baseKey: string;
  category: ItemCategory;
  namePrefix: string;
  description: string;
  board: "xp" | "days";
};

// Đồ thành tích: một món riêng cho MỖI tháng, mã dạng "<baseKey>@YYYY-MM".
export const ACHIEVEMENT_TEMPLATES: AchievementTemplate[] = [
  {
    baseKey: "frame:champion",
    category: "frame",
    namePrefix: "Quán quân tháng",
    description: "Hạng 1 XP trong Tổng kết tháng",
    board: "xp"
  },
  {
    baseKey: "bg:diligent",
    category: "background",
    namePrefix: "Chuyên cần tháng",
    description: "Hạng 1 số ngày học trong Tổng kết tháng",
    board: "days"
  }
];

export const ART_KEYS: string[] = [
  ...SHOP_ITEMS.map((item) => item.key),
  ...ACHIEVEMENT_TEMPLATES.map((template) => template.baseKey)
];

// Tháng đầu tiên có bài nộp trên nền tảng — đồ thành tích tính hồi tố từ đây.
export const ACHIEVEMENT_START_MONTH = "2026-07";

export function resolveItem(itemKey: string | null | undefined): ResolvedItem | null {
  if (!itemKey) return null;

  const at = itemKey.indexOf("@");

  if (at === -1) {
    const item = SHOP_ITEMS.find((candidate) => candidate.key === itemKey);
    return item ? { ...item, artKey: item.key, monthKey: null } : null;
  }

  const baseKey = itemKey.slice(0, at);
  const monthKey = itemKey.slice(at + 1);
  const template = ACHIEVEMENT_TEMPLATES.find((candidate) => candidate.baseKey === baseKey);

  if (!template || !isMonthKey(monthKey)) return null;

  const [year, month] = monthKey.split("-");

  return {
    key: itemKey,
    name: `${template.namePrefix} ${Number(month)}/${year}`,
    category: template.category,
    rarity: "achievement",
    price: null,
    description: template.description,
    artKey: template.baseKey,
    monthKey
  };
}

// Các tháng đã khép (từ tháng đầu tới tháng trước tháng hiện tại, giờ VN).
export function closedMonthKeys(now: Date): string[] {
  const current = monthKeyOf(now);
  const keys: string[] = [];

  for (let key = ACHIEVEMENT_START_MONTH; key < current; key = shiftMonthKey(key, 1)) {
    keys.push(key);
  }

  return keys;
}

export type AchievementItem = { studentId: string; itemKey: string };

export function achievementItemsFor(recap: MonthlyRecap): AchievementItem[] {
  const items: AchievementItem[] = [];

  for (const template of ACHIEVEMENT_TEMPLATES) {
    for (const entry of recap.entries) {
      const rank = template.board === "xp" ? entry.xpRank : entry.daysRank;

      if (rank === 1) {
        items.push({ studentId: entry.studentId, itemKey: `${template.baseKey}@${recap.monthKey}` });
      }
    }
  }

  return items;
}
