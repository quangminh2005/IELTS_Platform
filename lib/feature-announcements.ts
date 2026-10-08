import { vnDateKey } from "@/lib/attendance";
import type { MascotId, PoseId } from "@/lib/mascots";

// Banner "✦ TÍNH NĂNG MỚI" ở trang chủ học viên và trang Tổng quan của thầy — kiểu
// khối "Marketing TV" của chin.edu.vn. Hình là linh vật SVG (components/shop/
// mascot-art.tsx) trên nền chuyển màu, vẽ ở components/feature-banner.tsx.
//
// QUY TẮC: ship tính năng nào người dùng nhìn thấy thì thêm MỘT slide vào
// FEATURE_ANNOUNCEMENTS trong cùng lần push. Slide tự hiện ANNOUNCEMENT_DAYS ngày kể
// từ shippedAt rồi tự ẩn — không cần quay lại xoá. Không còn slide nào thì banner
// biến mất hẳn.
//
// Module thuần: không đụng Prisma, không đụng React.

export const ANNOUNCEMENT_DAYS = 30;
export const MAX_ANNOUNCEMENTS = 6;

export type AnnouncementAudience = "student" | "teacher";

// Bảng màu nền từng slide. `background` là CSS background (nền tối để chữ trắng
// luôn đọc được), `accent` tô nhãn "Tính năng mới" + nút.
export const BANNER_THEMES = {
  night: {
    background:
      "radial-gradient(circle at 22% 35%, rgba(129,140,248,0.45), rgba(0,0,0,0) 50%), linear-gradient(135deg, #1e1b4b, #0f172a 60%, #020617)",
    accent: "#c7d2fe"
  },
  forest: {
    background:
      "radial-gradient(circle at 22% 35%, rgba(178,210,53,0.38), rgba(0,0,0,0) 50%), linear-gradient(135deg, #16351f, #0b1d12 60%, #04100a)",
    accent: "#d9f99d"
  },
  plum: {
    background:
      "radial-gradient(circle at 22% 35%, rgba(244,114,182,0.4), rgba(0,0,0,0) 50%), linear-gradient(135deg, #4a0d3a, #24091f 60%, #12040f)",
    accent: "#fbcfe8"
  },
  ember: {
    background:
      "radial-gradient(circle at 22% 35%, rgba(251,146,60,0.45), rgba(0,0,0,0) 50%), linear-gradient(135deg, #4a1a07, #261004 60%, #140802)",
    accent: "#fed7aa"
  },
  ocean: {
    background:
      "radial-gradient(circle at 22% 35%, rgba(56,189,248,0.42), rgba(0,0,0,0) 50%), linear-gradient(135deg, #0c3350, #071c2e 60%, #030d17)",
    accent: "#bae6fd"
  },
  dusk: {
    background:
      "radial-gradient(circle at 22% 35%, rgba(167,139,250,0.45), rgba(0,0,0,0) 50%), linear-gradient(135deg, #34116e, #1a0b3a 60%, #0c051d)",
    accent: "#ddd6fe"
  }
} as const;

export type BannerTheme = keyof typeof BANNER_THEMES;

export type FeatureAnnouncement = {
  id: string;
  audience: AnnouncementAudience;
  title: [string, string]; // hai dòng tiêu đề, mỗi dòng ngắn (~20 ký tự)
  description: string; // một câu
  cta: string; // chữ trên nút
  href: string; // /student/... cho học viên, /teacher/... cho thầy
  mascot: MascotId;
  pose: PoseId;
  theme: BannerTheme;
  shippedAt: string; // "YYYY-MM-DD" theo giờ Việt Nam
};

// Mới thêm lên ĐẦU danh sách cho dễ nhìn (thứ tự hiển thị vẫn sắp theo shippedAt).
export const FEATURE_ANNOUNCEMENTS: FeatureAnnouncement[] = [
  // ---- Học viên ----
  {
    id: "student-feed",
    audience: "student",
    title: ["Bảng tin", "Học cùng bạn bè"],
    description:
      "Theo dõi bạn học, thả tim và bình luận khi bạn bè nộp bài, lên hạng hay giữ chuỗi ngày.",
    cta: "Xem bảng tin",
    href: "/student/feed",
    mascot: "cat",
    pose: "wave",
    theme: "plum",
    shippedAt: "2026-10-06"
  },
  {
    id: "student-shop",
    audience: "student",
    title: ["Cửa hàng Xu", "Tranh danh hoạ & quà"],
    description:
      "Dùng Xu kiếm được khi học để đổi nền hồ sơ tranh danh hoạ, khung avatar có hiệu ứng, hoặc đổi quà thật từ thầy.",
    cta: "Vào cửa hàng",
    href: "/student/shop",
    mascot: "owl",
    pose: "cheer",
    theme: "dusk",
    shippedAt: "2026-10-06"
  },
  {
    id: "student-xp-ranks",
    audience: "student",
    title: ["Hạng đấu", "Leo hạng bằng XP"],
    description:
      "Mỗi bài nộp, mỗi lượt ôn từ đều cộng XP. 7 hạng, 27 cấp — xem mình đang ở đâu và còn bao nhiêu XP để lên hạng.",
    cta: "Xem hạng của tôi",
    href: "/student/ranks",
    mascot: "dragon",
    pose: "cheer",
    theme: "ember",
    shippedAt: "2026-10-05"
  },
  {
    id: "student-hide-audio",
    audience: "student",
    title: ["Tự luyện Nghe", "Ẩn audio, +50% XP"],
    description:
      "Tích “Ẩn thanh audio” khi mở đề Nghe: không tua lại được, nhưng XP và Xu phần Nghe được nhân 1,5.",
    cta: "Thử ngay",
    href: "/student/practice",
    mascot: "cat",
    pose: "signature",
    theme: "ocean",
    shippedAt: "2026-10-05"
  },
  {
    id: "student-mascots",
    audience: "student",
    title: ["Linh vật", "Bạn đồng hành mới"],
    description:
      "Đổi Xu lấy Cú, Mèo, Cáo hay Rồng, mở khoá tư thế và khoe trên hồ sơ cùng thẻ chuỗi ngày.",
    cta: "Khám phá",
    href: "/student/shop?tab=mascot",
    mascot: "fox",
    pose: "signature",
    theme: "forest",
    shippedAt: "2026-10-04"
  },

  // ---- Thầy ----
  {
    id: "teacher-feed",
    audience: "teacher",
    title: ["Bảng tin", "Theo dõi cả lớp"],
    description:
      "Xem học viên vừa nộp bài, lên hạng hay giữ chuỗi; đọc và gỡ bình luận mới ở một chỗ.",
    cta: "Mở bảng tin",
    href: "/teacher/feed",
    mascot: "dragon",
    pose: "wave",
    theme: "plum",
    shippedAt: "2026-10-06"
  },
  {
    id: "teacher-speaking-timing",
    audience: "teacher",
    title: ["Chấm Speaking", "Thấy rõ nhịp nói"],
    description:
      "Trang chấm hiện tốc độ nói và các chỗ ngừng của học viên; AI cũng dựa vào số đo này khi chấm Fluency.",
    cta: "Vào chấm bài",
    href: "/teacher/review",
    mascot: "fox",
    pose: "read",
    theme: "dusk",
    shippedAt: "2026-10-06"
  },
  {
    id: "teacher-ai-draft",
    audience: "teacher",
    title: ["AI chấm nháp", "Thầy duyệt, AI soạn"],
    description:
      "Bấm “AI chấm nháp” ở trang chấm Writing/Speaking: AI điền phiếu và bôi lỗi, thầy giữ hay bỏ rồi Lưu.",
    cta: "Vào chấm bài",
    href: "/teacher/review",
    mascot: "owl",
    pose: "signature",
    theme: "night",
    shippedAt: "2026-10-05"
  },
  {
    id: "teacher-schedule",
    audience: "teacher",
    title: ["Lịch học", "Mỗi lớp một tab"],
    description:
      "Đặt lịch cố định hàng tuần, báo nghỉ hay học bù — học viên thấy ngay ở trang Lịch học của mình.",
    cta: "Đặt lịch",
    href: "/teacher/schedule",
    mascot: "cat",
    pose: "read",
    theme: "forest",
    shippedAt: "2026-09-30"
  }
];

const DAY_MS = 24 * 60 * 60 * 1000;

// Số ngày từ khoá "YYYY-MM-DD" a đến b (cả hai đều là ngày VN, tính như UTC).
function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / DAY_MS);
}

// Slide đang hiện cho một vai trò: đúng audience, ship trong ANNOUNCEMENT_DAYS ngày
// gần nhất (ngày ship tính là ngày 0, ngày tương lai chưa hiện), mới nhất trước,
// tối đa MAX_ANNOUNCEMENTS. Cùng ngày thì giữ thứ tự trong danh sách.
export function activeAnnouncements(
  list: FeatureAnnouncement[],
  audience: AnnouncementAudience,
  now: Date
): FeatureAnnouncement[] {
  const today = vnDateKey(now);
  return list
    .filter((item) => {
      if (item.audience !== audience) return false;
      const age = daysBetween(item.shippedAt, today);
      return age >= 0 && age < ANNOUNCEMENT_DAYS;
    })
    .map((item, order) => ({ item, order }))
    .sort((a, b) => b.item.shippedAt.localeCompare(a.item.shippedAt) || a.order - b.order)
    .slice(0, MAX_ANNOUNCEMENTS)
    .map(({ item }) => item);
}
