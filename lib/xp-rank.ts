// Hạng đấu kiểu chin.edu.vn: XP TÍCH LUỸ TRỌN ĐỜI, chỉ tăng không bao giờ tụt.
// 7 hạng × 27 cấp. XP lấy từ sổ Xu (lib/xp-rank-data.ts) — cùng nguồn với Xu nên
// hạng và ví luôn đi cùng nhau.
//
// Ngưỡng đặt theo phân bố thật trên prod 5/10/2026 (3 tháng đầu: trung vị 405 XP,
// nhóm 75% 646 XP, cao nhất 2.625 XP ≈ 200 XP/tháng cho em học đều): học đều cả
// năm lên tầm Vàng, Thách Đấu cần vài năm. Đổi ngưỡng = đổi bảng dưới (test ép
// tăng dần + đúng 27 cấp).
//
// Module thuần: không Prisma, không React.

// Loại dòng sổ Xu được tính là XP kiếm được (mua đồ / cứu chuỗi / đổi quà không trừ XP).
export const XP_EARN_KINDS = ["earn_unit", "earn_vocab"] as const;

export type XpRank = {
  key: string;
  label: string;
  tagline: string;
  icon: string;
  // class Tailwind cho chip (nền + chữ, hợp dark mode) và cho chữ tên hạng
  badgeClass: string;
  textClass: string;
  // Ngưỡng XP của từng cấp (I, II, …), tăng dần; levels[0] = ngưỡng vào hạng.
  levels: number[];
};

export const XP_RANKS: XpRank[] = [
  {
    key: "bronze",
    label: "Đồng",
    tagline: "Khởi đầu hành trình — tập thói quen làm bài đều mỗi tuần.",
    icon: "🥉",
    badgeClass: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    textClass: "text-orange-600 dark:text-orange-400",
    levels: [0, 60, 150, 250, 370]
  },
  {
    key: "silver",
    label: "Bạc",
    tagline: "Đã vào nhịp — bài giao nộp đủ, Sổ từ ôn đều.",
    icon: "🥈",
    badgeClass: "bg-slate-400/20 text-slate-600 dark:text-slate-300",
    textClass: "text-slate-500 dark:text-slate-300",
    levels: [500, 750, 1000, 1250]
  },
  {
    key: "gold",
    label: "Vàng",
    tagline: "Bền bỉ nhiều tháng — tự luyện thêm ngoài bài thầy giao.",
    icon: "🥇",
    badgeClass: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
    textClass: "text-yellow-600 dark:text-yellow-400",
    levels: [1500, 2000, 2500, 3000]
  },
  {
    key: "platinum",
    label: "Bạch Kim",
    tagline: "Luyện đề như cơm bữa — kỹ năng nào cũng có dấu chân.",
    icon: "💠",
    badgeClass: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    textClass: "text-cyan-600 dark:text-cyan-300",
    levels: [3500, 4400, 5300, 6200]
  },
  {
    key: "diamond",
    label: "Kim Cương",
    tagline: "Hiếm ai theo kịp — một năm học không ngơi nghỉ.",
    icon: "💎",
    badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    textClass: "text-sky-600 dark:text-sky-300",
    levels: [7000, 8250, 9500, 10750]
  },
  {
    key: "master",
    label: "Cao Thủ",
    tagline: "Huyền thoại của lớp — đàn em nhìn vào để noi theo.",
    icon: "⚔️",
    badgeClass: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
    textClass: "text-purple-600 dark:text-purple-400",
    levels: [12000, 14700, 17300]
  },
  {
    key: "challenger",
    label: "Thách Đấu",
    tagline: "Đỉnh cao cuối cùng — dành cho người không bao giờ bỏ cuộc.",
    icon: "👑",
    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    textClass: "text-rose-600 dark:text-rose-400",
    levels: [20000, 25000, 30000]
  }
];

export const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

export const TOTAL_LEVELS = XP_RANKS.reduce((sum, rank) => sum + rank.levels.length, 0);

// Ngưỡng trên (không gồm) của hạng; hạng cuối không có trần.
export function rankMax(rankIndex: number): number | null {
  const next = XP_RANKS[rankIndex + 1];
  return next ? next.levels[0] - 1 : null;
}

export type XpLevelRef = { rank: XpRank; rankIndex: number; levelIndex: number; min: number };

export function levelName(ref: Pick<XpLevelRef, "rank" | "levelIndex">): string {
  return `${ref.rank.label} ${ROMAN[ref.levelIndex]}`;
}

// Mọi cấp xếp phẳng theo thứ tự tăng dần.
export const ALL_LEVELS: XpLevelRef[] = XP_RANKS.flatMap((rank, rankIndex) =>
  rank.levels.map((min, levelIndex) => ({ rank, rankIndex, levelIndex, min }))
);

export type XpProgress = {
  xp: number;
  current: XpLevelRef;
  next: XpLevelRef | null;
  xpToNext: number | null;
  // % đi được trong cấp hiện tại (cấp cuối = 100)
  percent: number;
};

export function getXpProgress(rawXp: number): XpProgress {
  const xp = Math.max(0, Math.floor(rawXp));
  let index = 0;
  for (let i = 0; i < ALL_LEVELS.length; i += 1) {
    if (xp >= ALL_LEVELS[i].min) index = i;
  }

  const current = ALL_LEVELS[index];
  const next = ALL_LEVELS[index + 1] ?? null;
  const percent = next ? Math.min(100, ((xp - current.min) / (next.min - current.min)) * 100) : 100;

  return { xp, current, next, xpToNext: next ? next.min - xp : null, percent };
}
