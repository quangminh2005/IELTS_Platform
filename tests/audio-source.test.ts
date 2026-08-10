import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isAllowedAudioUrl } from "@/lib/audio-source";

const root = process.cwd();

// Bản ghi Speaking thật trên prod đều nằm ở Vercel Blob, dạng:
// https://<ma-kho>.public.blob.vercel-storage.com/speaking-<id>-<timestamp>-<random>
const REAL =
  "https://yr2odb5jaalgrfbg.public.blob.vercel-storage.com/speaking-abc123-1786267342171-Ia1i7xY";

describe("chốt nguồn file ghi âm được phép tải về", () => {
  it("nhận URL Vercel Blob thật", () => {
    expect(isAllowedAudioUrl(REAL)).toBe(true);
  });

  it("không phân biệt hoa thường ở tên miền", () => {
    expect(isAllowedAudioUrl(REAL.replace("yr2odb5jaalgrfbg", "YR2ODB5JAALGRFBG"))).toBe(true);
  });

  // Đây là lỗ hổng cần bịt: Answer.value là chuỗi client gửi lên ở ô q_<id>, học
  // viên gửi POST tay là đặt được URL bất kỳ. Giáo viên bấm "Phiên âm" thì máy chủ
  // đi tải hộ URL đó — đường vào mạng nội bộ.
  it.each([
    ["endpoint metadata của máy chủ", "http://169.254.169.254/latest/meta-data/"],
    ["localhost", "http://localhost:3000/api/cron/reminders"],
    ["địa chỉ vòng lặp", "http://127.0.0.1:5432/"],
    ["mạng nội bộ", "http://10.0.0.5/admin"],
    ["giao thức file", "file:///etc/passwd"],
    ["giao thức lạ", "gopher://evil.tld/"],
    ["http thường (không mã hoá)", "http://abc.public.blob.vercel-storage.com/x"],
    ["tên miền giả mạo hậu tố", "https://public.blob.vercel-storage.com.evil.tld/x"],
    ["nhét tên miền thật vào phần user", "https://a.public.blob.vercel-storage.com@evil.tld/x"],
    ["nhét tên miền thật vào query", "https://evil.tld/?x=.public.blob.vercel-storage.com"],
    ["nhét tên miền thật vào path", "https://evil.tld/a.public.blob.vercel-storage.com"],
    ["thiếu mã kho", "https://public.blob.vercel-storage.com/x"],
    ["chuỗi rỗng", ""],
    ["rác", "khong-phai-url"]
  ])("chặn %s", (_label, value) => {
    expect(isAllowedAudioUrl(value)).toBe(false);
  });
});

describe("hành động phiên âm", () => {
  const source = readFileSync(join(root, "lib", "actions", "transcribe.ts"), "utf8");

  it("chốt URL trước khi fetch", () => {
    expect(source).toContain("isAllowedAudioUrl");
  });

  it("không còn chỉ kiểm mỗi tiền tố http", () => {
    expect(source).not.toMatch(/\/\^https\?:\\\/\\\//);
  });

  it("không đi theo chuyển hướng (redirect có thể trỏ ngược vào mạng nội bộ)", () => {
    expect(source).toMatch(/redirect:\s*"error"/);
  });
});
