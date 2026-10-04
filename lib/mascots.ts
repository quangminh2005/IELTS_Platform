import type { ItemRarity } from "@/lib/shop-catalog";

// Linh vật (Xu Đợt 4) — kiểu chin: mua con (kèm sẵn "Đứng yên"), rồi mở từng tư thế
// bằng Xu; tư thế cao có thêm đường "hoặc chuỗi N ngày". Hình vẽ ở
// components/shop/mascot-art.tsx theo mã con + mã tư thế (test ép đủ cặp).
//
// Mã trong StudentItem: "mascot:<con>" (mua con), "pose:<con>:<tư thế>" (mở tư thế).
// "Đứng yên" không có dòng — có con là có. StudentProfile.equippedMascot = mã tư thế.

export const MASCOT_IDS = ["owl", "cat", "fox", "dragon"] as const;
export type MascotId = (typeof MASCOT_IDS)[number];

export const POSE_IDS = ["idle", "wave", "read", "cheer", "sleep", "signature"] as const;
export type PoseId = (typeof POSE_IDS)[number];

export type Mascot = {
  id: MascotId;
  name: string;
  price: number;
  rarity: ItemRarity;
  signatureName: string; // tên tư thế đinh riêng của con
  description: string;
};

export type MascotPose = {
  id: PoseId;
  name: string; // tư thế đinh lấy Mascot.signatureName
  price: number; // 0 = kèm con
  streakDays: number | null; // "hoặc chuỗi N ngày"
};

export const MASCOTS: Mascot[] = [
  {
    id: "owl",
    name: "Cú Thông Thái",
    price: 600,
    rarity: "rare",
    signatureName: "Tốt nghiệp",
    description: "Đeo kính, mê sách — bạn đồng hành của dân luyện Reading"
  },
  {
    id: "cat",
    name: "Mèo Cam",
    price: 600,
    rarity: "rare",
    signatureName: "Đeo tai nghe",
    description: "Lười mà học giỏi, nghe Listening không sót chữ nào"
  },
  {
    id: "fox",
    name: "Cáo Lanh Lợi",
    price: 1000,
    rarity: "epic",
    signatureName: "Thám tử",
    description: "Soi từng keyword, bẫy nào cũng phát hiện"
  },
  {
    id: "dragon",
    name: "Rồng Con",
    price: 2000,
    rarity: "legendary",
    signatureName: "Phun lửa",
    description: "Nhỏ mà có võ — band nào cũng đốt cháy"
  }
];

export const MASCOT_POSES: MascotPose[] = [
  { id: "idle", name: "Đứng yên", price: 0, streakDays: null },
  { id: "wave", name: "Vẫy tay", price: 100, streakDays: null },
  { id: "read", name: "Đọc sách", price: 150, streakDays: null },
  { id: "cheer", name: "Nhảy mừng", price: 250, streakDays: null },
  { id: "sleep", name: "Ngủ gật", price: 400, streakDays: 15 },
  { id: "signature", name: "Tư thế đinh", price: 800, streakDays: 30 }
];

export function mascotKey(id: MascotId): string {
  return `mascot:${id}`;
}

export function poseKey(id: MascotId, pose: PoseId): string {
  return `pose:${id}:${pose}`;
}

export function findMascot(id: string): Mascot | null {
  return MASCOTS.find((mascot) => mascot.id === id) ?? null;
}

export function poseName(mascot: Mascot, pose: MascotPose): string {
  return pose.id === "signature" ? mascot.signatureName : pose.name;
}

export type ResolvedPose = {
  key: string;
  mascot: Mascot;
  pose: MascotPose;
  name: string;
};

// "pose:owl:wave" → con + tư thế; mã lạ → null.
export function resolvePose(key: string | null | undefined): ResolvedPose | null {
  if (!key) return null;
  const parts = key.split(":");
  if (parts.length !== 3 || parts[0] !== "pose") return null;

  const mascot = findMascot(parts[1]);
  const pose = MASCOT_POSES.find((candidate) => candidate.id === parts[2]);
  if (!mascot || !pose) return null;

  return { key, mascot, pose, name: poseName(mascot, pose) };
}

// "Đứng yên" đi kèm con; tư thế khác cần dòng riêng.
export function ownsPose(owned: Set<string>, key: string): boolean {
  const resolved = resolvePose(key);
  if (!resolved) return false;
  if (!owned.has(mascotKey(resolved.mascot.id))) return false;
  return resolved.pose.id === "idle" || owned.has(key);
}
