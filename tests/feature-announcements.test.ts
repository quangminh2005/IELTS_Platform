import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ANNOUNCEMENT_DAYS,
  BANNER_THEMES,
  FEATURE_ANNOUNCEMENTS,
  MAX_ANNOUNCEMENTS,
  activeAnnouncements,
  type FeatureAnnouncement
} from "../lib/feature-announcements";
import { MASCOT_IDS, POSE_IDS } from "../lib/mascots";

const read = (path: string) => readFileSync(path, "utf8");

function slide(id: string, shippedAt: string, audience: "student" | "teacher" = "student"): FeatureAnnouncement {
  return {
    id,
    audience,
    title: ["A", "B"],
    description: "x",
    cta: "Xem",
    href: audience === "student" ? "/student" : "/teacher",
    mascot: "owl",
    pose: "idle",
    theme: "night",
    shippedAt
  };
}

// 10h sáng 8/10/2026 giờ VN.
const NOW = new Date("2026-10-08T03:00:00Z");

describe("activeAnnouncements", () => {
  it("chỉ lấy slide đúng vai trò", () => {
    const list = [slide("a", "2026-10-07"), slide("b", "2026-10-07", "teacher")];
    expect(activeAnnouncements(list, "student", NOW).map((s) => s.id)).toEqual(["a"]);
    expect(activeAnnouncements(list, "teacher", NOW).map((s) => s.id)).toEqual(["b"]);
  });

  it("hiện từ ngày ship tới hết ngày thứ 29, chưa hiện slide ngày tương lai", () => {
    expect(ANNOUNCEMENT_DAYS).toBe(30);
    const list = [
      slide("today", "2026-10-08"),
      slide("day29", "2026-09-09"),
      slide("day30", "2026-09-08"),
      slide("future", "2026-10-09")
    ];
    expect(activeAnnouncements(list, "student", NOW).map((s) => s.id)).toEqual(["today", "day29"]);
  });

  it("tính ngày theo giờ VN — 23h tối 7/10 giờ UTC đã là 8/10 ở VN", () => {
    const lateUtc = new Date("2026-10-07T18:00:00Z"); // 1h sáng 8/10 giờ VN
    expect(activeAnnouncements([slide("x", "2026-10-08")], "student", lateUtc)).toHaveLength(1);
  });

  it("mới nhất trước, cùng ngày giữ thứ tự khai báo, tối đa 6", () => {
    const list = [
      slide("old", "2026-10-01"),
      slide("new1", "2026-10-07"),
      slide("new2", "2026-10-07"),
      slide("mid", "2026-10-04"),
      slide("c", "2026-10-02"),
      slide("d", "2026-10-03"),
      slide("e", "2026-10-05")
    ];
    expect(MAX_ANNOUNCEMENTS).toBe(6);
    expect(activeAnnouncements(list, "student", NOW).map((s) => s.id)).toEqual([
      "new1",
      "new2",
      "e",
      "mid",
      "d",
      "c"
    ]);
  });
});

describe("danh sách slide thật", () => {
  it("id không trùng", () => {
    const ids = FEATURE_ANNOUNCEMENTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(FEATURE_ANNOUNCEMENTS.map((s) => [s.id, s] as const))("%s hợp lệ", (_id, s) => {
    expect(s.href.startsWith(s.audience === "student" ? "/student" : "/teacher")).toBe(true);
    expect(s.shippedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(`${s.shippedAt}T00:00:00Z`))).toBe(false);
    expect(MASCOT_IDS).toContain(s.mascot);
    expect(POSE_IDS).toContain(s.pose);
    expect(Object.keys(BANNER_THEMES)).toContain(s.theme);
    expect(s.title).toHaveLength(2);
    expect(s.title.every((line) => line.trim().length > 0 && line.length <= 24)).toBe(true);
    expect(s.description.trim().length).toBeGreaterThan(0);
  });

  it("hai trang chủ đều gắn banner với đúng vai trò", () => {
    const student = read("app/student/page.tsx");
    const teacher = read("app/teacher/page.tsx");
    expect(student).toContain('activeAnnouncements(FEATURE_ANNOUNCEMENTS, "student"');
    expect(student).toContain("<FeatureBanner");
    expect(teacher).toContain('activeAnnouncements(FEATURE_ANNOUNCEMENTS, "teacher"');
    expect(teacher).toContain("<FeatureBanner");
  });
});
