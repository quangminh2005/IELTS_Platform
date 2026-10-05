import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CUSTOM_COVER_KEY, isAllowedCoverUrl, resolveCover } from "@/lib/profile-cover";

function read(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), "utf8").replace(/\r\n/g, "\n");
}

const COVER = "https://abc.public.blob.vercel-storage.com/covers/u1-xyz.webp";

describe("resolveCover — bìa hồ sơ hiện gì", () => {
  it("nền Cửa hàng thắng mọi thứ", () => {
    expect(
      resolveCover({ equippedBackground: "bg:ocean", coverImageUrl: COVER, coverColor: "rose" }).kind
    ).toBe("art");
  });

  it("đang chọn ảnh riêng + URL hợp lệ → hiện ảnh", () => {
    expect(
      resolveCover({ equippedBackground: CUSTOM_COVER_KEY, coverImageUrl: COVER, coverColor: "rose" })
    ).toEqual({ kind: "image", src: COVER });
  });

  it("có ảnh nhưng không chọn → vẫn là màu bìa (ảnh giữ để chọn lại)", () => {
    expect(
      resolveCover({ equippedBackground: null, coverImageUrl: COVER, coverColor: "rose" }).kind
    ).toBe("color");
  });

  it("chọn ảnh riêng mà ảnh đã bị thầy gỡ → rơi về màu bìa, không vỡ trang", () => {
    expect(
      resolveCover({ equippedBackground: CUSTOM_COVER_KEY, coverImageUrl: null, coverColor: "rose" }).kind
    ).toBe("color");
  });

  it("URL ảnh lạ (ngoài covers/) không bao giờ được hiện", () => {
    expect(
      resolveCover({
        equippedBackground: CUSTOM_COVER_KEY,
        coverImageUrl: "https://evil.example.com/x.png",
        coverColor: null
      }).kind
    ).toBe("color");
  });
});

describe("isAllowedCoverUrl — chốt trước khi del() ảnh nền cũ", () => {
  it("nhận file trong covers/ của Blob store mình", () => {
    expect(isAllowedCoverUrl(COVER)).toBe(true);
  });

  it("từ chối avatar, audio Listening, host lạ và %2F lách thư mục", () => {
    expect(isAllowedCoverUrl("https://abc.public.blob.vercel-storage.com/avatars/x.webp")).toBe(false);
    expect(isAllowedCoverUrl("https://abc.public.blob.vercel-storage.com/listening/a.mp3")).toBe(false);
    expect(isAllowedCoverUrl("https://public.blob.vercel-storage.com.evil.com/covers/x.webp")).toBe(false);
    expect(isAllowedCoverUrl("https://abc.public.blob.vercel-storage.com/covers/..%2Flistening/a.mp3")).toBe(
      false
    );
  });
});

describe("route tải ảnh nền", () => {
  const source = read("app", "api", "student", "cover", "route.ts");

  it("chỉ học viên đã đăng nhập", () => {
    expect(source).toContain("await auth()");
    expect(source).toMatch(/role !== "student"/);
  });

  it("chặn file lớn, không nhận SVG, ghi vào covers/", () => {
    expect(source).toContain("1024 * 1024");
    expect(source).not.toContain("image/svg+xml");
    expect(source).toContain("covers/");
  });
});

describe("action hồ sơ — phần ảnh nền / tên / nền-khung", () => {
  const source = read("lib", "actions", "profile.ts");

  it("nền/khung chọn trong bảng chỉnh sửa phải là đồ đã sở hữu", () => {
    const fn = source.slice(source.indexOf("async function readSelfExtras("));
    expect(fn).toMatch(/studentItem\.findMany/);
    expect(fn).toMatch(/studentId:\s*student\.id/);
  });

  it("các trường mới gate bằng formData.has — form cũ không gửi thì giữ nguyên", () => {
    const fn = source.slice(source.indexOf("async function readSelfExtras("), source.indexOf("async function assertCoverUrlNotTaken("));
    for (const field of ["displayName", "coverImageUrl", "equippedBackground", "equippedFrame"]) {
      expect(fn).toMatch(new RegExp(`formData\\.has\\(\\s*["']${field}["']\\s*\\)`));
    }
  });

  it("chặn mượn URL ảnh nền của bạn học và chỉ xoá file trong covers/", () => {
    expect(source).toMatch(/assertCoverUrlNotTaken\(extras\.coverImageUrl/);
    const del = source.slice(source.indexOf("async function deleteOldCover("));
    expect(del.slice(0, 300)).toContain("!isAllowedCoverUrl(oldUrl)");
  });

  it("thầy gỡ ảnh nền: requireTeacher + lọc lớp của thầy ngay trong where", () => {
    const fn = source.slice(source.indexOf("export async function removeStudentCoverImage("));
    expect(fn).toContain("requireTeacher()");
    expect(fn).toMatch(/classes:\s*\{\s*some:\s*\{\s*class:\s*\{\s*teacherId/);
  });
});

describe("cột coverImageUrl không bị bỏ sót", () => {
  it("ensure-db thêm cột lên prod", () => {
    expect(read("scripts", "ensure-db.mjs")).toContain('"coverImageUrl" TEXT');
  });

  it("blob-orphans coi ảnh nền đang dùng là KHÔNG mồ côi", () => {
    expect(read("scripts", "blob-orphans.mjs")).toContain('SELECT "coverImageUrl" FROM "StudentProfile"');
  });

  it("bảng chỉnh sửa gửi đủ các ô hồ sơ", () => {
    const drawer = read("components", "profile-edit-drawer.tsx");
    for (const field of [
      "displayName",
      "bio",
      "avatarUrl",
      "avatarPreset",
      "coverColor",
      "coverImageUrl",
      "equippedBackground",
      "equippedFrame",
      "targetBand"
    ]) {
      expect(drawer).toContain(`name="${field}"`);
    }
  });
});
