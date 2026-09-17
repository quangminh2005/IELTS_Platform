import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BUG_CATEGORIES,
  BUG_DAILY_LIMIT,
  bugCategoryLabel,
  buildBugReportEmail,
  describeDevice,
  formatBugContext,
  isAllowedBugImageUrl,
  isOverDailyLimit,
  parseBugContext
} from "../lib/bug-report";

describe("lược đồ BugReport", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  it("có model BugReport với đủ cột", () => {
    const start = schema.indexOf("model BugReport");
    expect(start).toBeGreaterThan(-1);
    const model = schema.slice(start);
    for (const column of [
      "studentId",
      "category",
      "description",
      "imageUrl",
      "pageUrl",
      "userAgent",
      "viewport",
      "attemptId",
      "contextJson",
      "teacherNote",
      "resolvedAt",
      "createdAt"
    ]) {
      expect(model).toContain(column);
    }
    expect(model).toMatch(/status\s+String\s+@default\("open"\)/);
    expect(model).toContain("onDelete: Cascade");
  });

  it("StudentProfile có quan hệ bugReports", () => {
    const model = schema.slice(
      schema.indexOf("model StudentProfile"),
      schema.indexOf("model Class")
    );
    expect(model).toMatch(/bugReports\s+BugReport\[\]/);
  });

  it("comment đầu schema liệt kê giá trị category và status", () => {
    expect(schema).toContain("audio | answer | display | other");
    expect(schema).toContain("open | resolved");
  });

  // Quên câu này là prod 500: Prisma Client không kiểm schema lúc chạy, lỗi chỉ
  // lộ khi có request đụng đúng bảng còn thiếu.
  it("ensure-db.mjs tạo bảng BugReport", () => {
    const script = readFileSync("scripts/ensure-db.mjs", "utf8");
    expect(script).toContain('CREATE TABLE IF NOT EXISTS "BugReport"');
    expect(script).toContain('"BugReport_studentId_createdAt_idx"');
    expect(script).toContain('"BugReport_status_createdAt_idx"');
    expect(script).toContain("BugReport_studentId_fkey");
  });
});

describe("loại lỗi", () => {
  it("có đúng 4 loại theo thứ tự", () => {
    expect(BUG_CATEGORIES.map((c) => c.value)).toEqual(["audio", "answer", "display", "other"]);
  });

  it("nhãn của loại lạ thì trả về 'Khác'", () => {
    expect(bugCategoryLabel("audio")).toBe("Audio không chạy");
    expect(bugCategoryLabel("xyz")).toBe("Khác");
  });
});

describe("describeDevice", () => {
  it("iPhone Safari 15", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1"
      )
    ).toBe("iPhone · Safari 15");
  });

  it("Android Chrome 120", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (Linux; Android 13; SM-A515F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
      )
    ).toBe("Android · Chrome 120");
  });

  it("Windows Edge 125 (UA có cả chữ Chrome)", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0"
      )
    ).toBe("Windows · Edge 125");
  });

  it("iPhone Chrome (CriOS) không bị nhận nhầm là Safari", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1"
      )
    ).toBe("iPhone · Chrome 120");
  });

  it("chuỗi lạ hoặc rỗng -> Không rõ", () => {
    expect(describeDevice("curl/8.0")).toBe("Không rõ");
    expect(describeDevice(null)).toBe("Không rõ");
    expect(describeDevice("")).toBe("Không rõ");
  });
});

describe("giới hạn & ngữ cảnh", () => {
  it("đủ 10 báo lỗi trong 24h thì chặn", () => {
    expect(isOverDailyLimit(BUG_DAILY_LIMIT - 1)).toBe(false);
    expect(isOverDailyLimit(BUG_DAILY_LIMIT)).toBe(true);
  });

  it("parseBugContext chịu được JSON hỏng", () => {
    expect(parseBugContext(null)).toEqual({});
    expect(parseBugContext("{oops")).toEqual({});
    expect(parseBugContext('{"unitTitle":"Part 2","step":3}')).toEqual({ unitTitle: "Part 2", step: 3 });
    expect(parseBugContext('{"unitTitle":5,"step":"x"}')).toEqual({});
  });

  it("formatBugContext ghép part + bước", () => {
    expect(formatBugContext({})).toBeNull();
    expect(formatBugContext({ unitTitle: "Part 2" })).toBe("Part 2");
    expect(formatBugContext({ unitTitle: "Part 2", step: 2 })).toBe("Part 2 · Bước 3");
  });

  it("chỉ nhận ảnh Blob của chính tính năng này", () => {
    expect(isAllowedBugImageUrl("https://abc.public.blob.vercel-storage.com/bug-reports/x-1.webp")).toBe(true);
    expect(isAllowedBugImageUrl("https://abc.public.blob.vercel-storage.com/avatars/x.webp")).toBe(false);
    expect(isAllowedBugImageUrl("https://evil.com/bug-reports/x.webp")).toBe(false);
    expect(isAllowedBugImageUrl("http://abc.public.blob.vercel-storage.com/bug-reports/x.webp")).toBe(false);
    expect(isAllowedBugImageUrl("không phải url")).toBe(false);
  });
});

describe("buildBugReportEmail", () => {
  const input = {
    studentName: "Nguyễn Văn A",
    categoryLabel: "Audio không chạy",
    description: "Bấm play <script>alert(1)</script> không được",
    createdAt: new Date("2026-09-17T03:00:00Z"),
    pageUrl: "/student/assignments/abc",
    device: "iPhone · Safari 15",
    viewport: "390x844",
    contextLine: "Part 2 · Bước 1",
    imageUrl: "https://abc.public.blob.vercel-storage.com/bug-reports/x.webp",
    appUrl: "https://example.vercel.app"
  };

  it("tiêu đề có tên học viên và loại lỗi", () => {
    expect(buildBugReportEmail(input).subject).toBe("[IELTS] Báo lỗi mới – Nguyễn Văn A: Audio không chạy");
  });

  it("html escape nội dung học viên nhập, có link web và ảnh", () => {
    const { html, text } = buildBugReportEmail(input);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("https://example.vercel.app/teacher/bugs");
    expect(html).toContain(input.imageUrl);
    expect(text).toContain("Part 2 · Bước 1");
    expect(text).toContain("390x844");
  });

  it("không có ảnh/ngữ cảnh thì không in dòng đó", () => {
    const { html } = buildBugReportEmail({ ...input, imageUrl: null, contextLine: null, viewport: null });
    expect(html).not.toContain("Ảnh chụp");
    expect(html).not.toContain("Vị trí");
  });
});
