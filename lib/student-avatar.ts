// Nguồn sự thật DUY NHẤT cho việc hiện avatar học viên. Mọi nơi (thanh điều hướng,
// bảng xếp hạng, trang giáo viên, báo cáo phụ huynh) đều gọi resolveStudentAvatar
// để không chỗ nào lệch chỗ nào.
//
// Module thuần: không đụng Prisma, không đụng React.

export type AvatarSource =
  | { kind: "image"; src: string }
  | { kind: "preset"; emoji: string; colorClass: string }
  | { kind: "initials"; text: string; colorClass: string };

// Avatar có sẵn cho học viên chọn — emoji + màu nền, không tốn Blob, không phải
// tải gì. Thêm mục mới thì thêm vào cuối, ĐỪNG đổi `key` của mục cũ (mã đang nằm
// trong DB của học viên đã chọn).
export const AVATAR_PRESETS = [
  { key: "cat", emoji: "🐱", colorClass: "bg-rose-500" },
  { key: "dog", emoji: "🐶", colorClass: "bg-amber-500" },
  { key: "fox", emoji: "🦊", colorClass: "bg-orange-500" },
  { key: "panda", emoji: "🐼", colorClass: "bg-slate-500" },
  { key: "owl", emoji: "🦉", colorClass: "bg-yellow-600" },
  { key: "penguin", emoji: "🐧", colorClass: "bg-sky-500" },
  { key: "frog", emoji: "🐸", colorClass: "bg-emerald-500" },
  { key: "bear", emoji: "🐻", colorClass: "bg-amber-700" },
  { key: "rocket", emoji: "🚀", colorClass: "bg-indigo-500" },
  { key: "book", emoji: "📚", colorClass: "bg-teal-500" },
  { key: "star", emoji: "⭐", colorClass: "bg-violet-500" },
  { key: "music", emoji: "🎧", colorClass: "bg-fuchsia-500" }
] as const;

// Dải bìa trang hồ sơ. Chọn từ bảng này chứ không cho nhập mã hex tự do — nhập tự
// do rất dễ ra nền làm chữ chìm mất.
export const COVER_COLORS = [
  { key: "rose", className: "bg-gradient-to-r from-rose-300 to-rose-400" },
  { key: "amber", className: "bg-gradient-to-r from-amber-300 to-orange-400" },
  { key: "emerald", className: "bg-gradient-to-r from-emerald-300 to-teal-400" },
  { key: "sky", className: "bg-gradient-to-r from-sky-300 to-cyan-400" },
  { key: "indigo", className: "bg-gradient-to-r from-indigo-300 to-violet-400" },
  { key: "fuchsia", className: "bg-gradient-to-r from-fuchsia-300 to-pink-400" },
  { key: "slate", className: "bg-gradient-to-r from-slate-300 to-slate-400" },
  { key: "lime", className: "bg-gradient-to-r from-lime-300 to-emerald-400" }
] as const;

export const AVATAR_PRESET_KEYS: string[] = AVATAR_PRESETS.map((p) => p.key);
export const COVER_COLOR_KEYS: string[] = COVER_COLORS.map((c) => c.key);
export const DEFAULT_COVER_KEY = "sky";

export function coverClassName(key: string | null): string {
  return (
    COVER_COLORS.find((c) => c.key === key)?.className ??
    COVER_COLORS.find((c) => c.key === DEFAULT_COVER_KEY)!.className
  );
}

// Chữ cái viết tắt (tối đa 2 ký tự, lấy đầu các từ). Chuyển từ
// components/class-ranking-board.tsx sang đây — GIỮ NGUYÊN thuật toán để avatar
// của học viên cũ không đổi hình dạng sau khi gom về một chỗ.
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "?";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Màu nền suy từ tên để mỗi học viên có một màu ổn định. Cũng chuyển nguyên từ
// class-ranking-board.tsx — đổi bảng màu hay hàm băm là màu của cả lớp đổi theo.
const INITIALS_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-fuchsia-500"
];

function initialsColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }

  return INITIALS_COLORS[hash % INITIALS_COLORS.length];
}

// Chỉ chấp nhận ảnh nằm trên Blob store của chính mình, VÀ nằm trong thư mục
// avatars/ — không phải bất kỳ file nào trên cùng store. Cùng một Blob store còn
// chứa audio Listening và ảnh tài liệu (xem lib/audio-source.ts); nếu chỉ kiểm
// hostname thì học viên dán được URL audio Listening vào ô avatarUrl của mình,
// rồi đổi avatar lần nữa khiến deleteOldAvatar() (lib/actions/profile.ts) xoá
// vĩnh viễn file audio của cả lớp. Route tải avatar (app/api/student/avatar,
// task sau) luôn ghi vào "avatars/<id>.webp" nên mọi avatar hợp lệ đều khớp
// tiền tố này.
export function isAllowedAvatarUrl(url: string): boolean {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") {
    return false;
  }

  // So khớp bằng ĐUÔI có dấu chấm dẫn đầu, không phải endsWith trần — nếu không
  // thì "public.blob.vercel-storage.com.doc-hai.com" cũng lọt.
  if (!parsed.hostname.endsWith(".public.blob.vercel-storage.com")) {
    return false;
  }

  if (!parsed.pathname.startsWith("/avatars/")) {
    return false;
  }

  // Chặn phần trăm-mã-hoá (vd. "%2F" thay cho "/") trong phần đuôi sau tiền tố —
  // pathname giữ nguyên dạng mã hoá nên "avatars/..%2Flistening/x.mp3" vẫn qua
  // được startsWith ở trên dù thực chất trỏ ra ngoài thư mục avatars/. Nhiều khả
  // năng vô hại (Blob store khớp theo chuỗi thô, del() cũng gửi thẳng chuỗi thô),
  // nhưng cái giá để chặn chỉ là một dòng, còn cái giá đoán sai là mất file audio
  // vĩnh viễn — nên chặn hẳn.
  const rest = parsed.pathname.slice("/avatars/".length);
  if (/%[0-9a-fA-F]{2}/.test(rest)) {
    return false;
  }

  return true;
}

// Thứ tự ưu tiên: ảnh tự tải -> avatar có sẵn -> ảnh Google -> chữ cái viết tắt.
export function resolveStudentAvatar(input: {
  avatarUrl: string | null;
  avatarPreset: string | null;
  userImage: string | null;
  displayName: string;
}): AvatarSource {
  if (input.avatarUrl && isAllowedAvatarUrl(input.avatarUrl)) {
    return { kind: "image", src: input.avatarUrl };
  }

  const preset = AVATAR_PRESETS.find((p) => p.key === input.avatarPreset);
  if (preset) {
    return { kind: "preset", emoji: preset.emoji, colorClass: preset.colorClass };
  }

  if (input.userImage) {
    return { kind: "image", src: input.userImage };
  }

  return {
    kind: "initials",
    text: initials(input.displayName),
    colorClass: initialsColor(input.displayName)
  };
}
