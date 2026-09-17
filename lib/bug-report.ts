// Logic thuần cho tính năng báo lỗi. KHÔNG import prisma: hộp thoại (client
// component) và trang giáo viên (server) đều dùng chung file này.

export const BUG_CATEGORY_VALUES = ["audio", "answer", "display", "other"] as const;
export type BugCategory = (typeof BUG_CATEGORY_VALUES)[number];

export const BUG_CATEGORIES: { value: BugCategory; label: string; hint: string }[] = [
  { value: "audio", label: "Audio không chạy", hint: "Không nghe được, bị đứng, không tua được" },
  { value: "answer", label: "Đáp án / chấm sai", hint: "Trả lời đúng mà bị chấm sai, giải thích sai" },
  { value: "display", label: "Hiển thị lỗi", hint: "Vỡ giao diện, thiếu chữ, ảnh không hiện" },
  { value: "other", label: "Khác", hint: "Lỗi khác không thuộc ba loại trên" }
];

export function bugCategoryLabel(value: string): string {
  return BUG_CATEGORIES.find((category) => category.value === value)?.label ?? "Khác";
}

export const BUG_STATUS_VALUES = ["open", "resolved"] as const;
export type BugStatus = (typeof BUG_STATUS_VALUES)[number];

export const BUG_DESCRIPTION_MAX = 1000;
export const BUG_TEACHER_NOTE_MAX = 500;
// Chống spam: quá số này trong 24 giờ thì từ chối.
export const BUG_DAILY_LIMIT = 10;
// Ảnh đã được trình duyệt thu nhỏ (cạnh dài 1280px, webp/jpeg) nên hiếm khi quá 300KB.
export const BUG_IMAGE_MAX_BYTES = 1024 * 1024;

export function isOverDailyLimit(countLast24h: number): boolean {
  return countLast24h >= BUG_DAILY_LIMIT;
}

// Ngữ cảnh màn làm bài gửi kèm: part đang mở + bước (chế độ làm từng bước, 0-based).
export type BugContext = { unitTitle?: string; step?: number };

export function parseBugContext(json: string | null | undefined): BugContext {
  if (!json) {
    return {};
  }

  try {
    const raw = JSON.parse(json) as unknown;
    if (!raw || typeof raw !== "object") {
      return {};
    }
    const record = raw as Record<string, unknown>;
    const context: BugContext = {};
    if (typeof record.unitTitle === "string" && record.unitTitle.trim()) {
      context.unitTitle = record.unitTitle.trim();
    }
    if (typeof record.step === "number" && Number.isInteger(record.step) && record.step >= 0) {
      context.step = record.step;
    }
    return context;
  } catch {
    return {};
  }
}

export function formatBugContext(context: BugContext): string | null {
  const parts: string[] = [];
  if (context.unitTitle) {
    parts.push(context.unitTitle);
  }
  if (typeof context.step === "number") {
    // Học viên thấy "Bước 1, 2, 3…" nên hiện 1-based.
    parts.push(`Bước ${context.step + 1}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

// Rút gọn userAgent thành "iPhone · Safari 15" để giáo viên đọc được. Thứ tự dò
// có chủ ý: Edge trước Chrome (UA Edge chứa cả "Chrome/"), CriOS/FxiOS trước
// Safari (mọi trình duyệt iOS đều mang chữ "Safari/").
export function describeDevice(userAgent: string | null | undefined): string {
  const ua = (userAgent ?? "").trim();
  if (!ua) {
    return "Không rõ";
  }

  let os = "";
  if (/iPhone/.test(ua)) {
    os = "iPhone";
  } else if (/iPad/.test(ua)) {
    os = "iPad";
  } else if (/Android/.test(ua)) {
    os = "Android";
  } else if (/Windows/.test(ua)) {
    os = "Windows";
  } else if (/Macintosh/.test(ua)) {
    os = "Mac";
  } else if (/Linux/.test(ua)) {
    os = "Linux";
  }

  let browser = "";
  let match: RegExpMatchArray | null;
  if ((match = ua.match(/Edg(?:e|A|iOS)?\/(\d+)/))) {
    browser = `Edge ${match[1]}`;
  } else if ((match = ua.match(/SamsungBrowser\/(\d+)/))) {
    browser = `Samsung ${match[1]}`;
  } else if ((match = ua.match(/(?:CriOS|Chrome)\/(\d+)/))) {
    browser = `Chrome ${match[1]}`;
  } else if ((match = ua.match(/(?:FxiOS|Firefox)\/(\d+)/))) {
    browser = `Firefox ${match[1]}`;
  } else if (/Safari\//.test(ua) && (match = ua.match(/Version\/(\d+)/))) {
    browser = `Safari ${match[1]}`;
  }

  const parts = [os, browser].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Không rõ";
}

// Chỉ nhận ảnh do chính route /api/student/bug-image tải lên (tiền tố bug-reports/).
// So khớp host bằng đuôi có dấu chấm dẫn đầu để "…vercel-storage.com.evil.com" không lọt.
export function isAllowedBugImageUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") {
    return false;
  }
  if (!parsed.hostname.endsWith(".public.blob.vercel-storage.com")) {
    return false;
  }
  return parsed.pathname.startsWith("/bug-reports/");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type BugReportEmailInput = {
  studentName: string;
  categoryLabel: string;
  description: string;
  createdAt: Date;
  pageUrl: string;
  device: string;
  viewport: string | null;
  contextLine: string | null;
  imageUrl: string | null;
  appUrl: string;
};

export function buildBugReportEmail(input: BugReportEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  // Chỉ dùng ở server (gửi mail báo lỗi) nên khởi tạo ngay trong hàm, không để
  // ở scope module — module này giờ còn được chuông thông báo phía client import.
  const emailDateFormatter = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh"
  });
  const subject = `[IELTS] Báo lỗi mới – ${input.studentName}: ${input.categoryLabel}`;
  const link = `${input.appUrl}/teacher/bugs`;
  const when = emailDateFormatter.format(input.createdAt);

  const rows: [string, string][] = [
    ["Học viên", input.studentName],
    ["Loại lỗi", input.categoryLabel],
    ["Thời gian", when],
    ["Trang", input.pageUrl],
    ["Thiết bị", input.device]
  ];
  if (input.viewport) {
    rows.push(["Màn hình", input.viewport]);
  }
  if (input.contextLine) {
    rows.push(["Vị trí", input.contextLine]);
  }

  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`
    )
    .join("");
  const imageHtml = input.imageUrl
    ? `<p style="margin:16px 0 4px;color:#6b7280">Ảnh chụp màn hình:</p><a href="${escapeHtml(input.imageUrl)}"><img src="${escapeHtml(input.imageUrl)}" alt="Ảnh chụp màn hình" style="max-width:100%;border:1px solid #e5e7eb;border-radius:8px"></a>`
    : "";

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#111827;max-width:640px">
<p style="margin:0 0 12px;font-weight:600">Học viên vừa gửi một báo lỗi trên IELTS Platform.</p>
<table style="border-collapse:collapse">${rowsHtml}</table>
<p style="margin:16px 0 4px;color:#6b7280">Mô tả:</p>
<blockquote style="margin:0;padding:12px 16px;background:#f3f4f6;border-left:4px solid #6366f1;border-radius:6px;white-space:pre-wrap">${escapeHtml(input.description)}</blockquote>
${imageHtml}
<p style="margin:24px 0 0"><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Xem trên web</a></p>
</div>`;

  const textLines = [
    "Học viên vừa gửi một báo lỗi trên IELTS Platform.",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Mô tả:",
    input.description,
    ...(input.imageUrl ? ["", `Ảnh chụp màn hình: ${input.imageUrl}`] : []),
    "",
    `Xem trên web: ${link}`
  ];

  return { subject, html, text: textLines.join("\n") };
}
