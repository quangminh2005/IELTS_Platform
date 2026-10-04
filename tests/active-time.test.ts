import { describe, expect, it } from "vitest";
import {
  ACTIVE_TICK_CAP_SECONDS,
  AUTO_SUBMIT_SKILLS,
  accumulateActiveSeconds,
  skillBudgetSeconds,
  isSkillTimeUp,
  resolveSkillBudgetSeconds,
  totalModeBudgetSeconds,
  totalRemainingSeconds
} from "@/lib/active-time";

describe("accumulateActiveSeconds", () => {
  it("cộng delta bình thường (~1s)", () => {
    expect(accumulateActiveSeconds(10, 1000)).toBeCloseTo(11);
  });

  it("chặn nhịp nhảy lớn ở mức cap (máy ngủ/tab nền/mất mạng)", () => {
    // delta 10 phút nhưng chỉ cộng tối đa cap giây
    expect(accumulateActiveSeconds(100, 600_000)).toBe(100 + ACTIVE_TICK_CAP_SECONDS);
  });

  it("không cộng khi delta âm (đồng hồ hệ thống lùi)", () => {
    expect(accumulateActiveSeconds(50, -5000)).toBe(50);
  });
});

describe("skillBudgetSeconds", () => {
  it("dùng giới hạn riêng của kỹ năng (đổi ra giây)", () => {
    expect(skillBudgetSeconds("reading", { reading: 30 }, true, null)).toBe(1800);
  });

  it("bài nhiều kỹ năng không đặt giờ kỹ năng đó → null", () => {
    expect(skillBudgetSeconds("writing", {}, true, 60)).toBeNull();
  });

  it("bài một kỹ năng không có giới hạn riêng → dùng giờ chung của bài", () => {
    expect(skillBudgetSeconds("listening", {}, false, 40)).toBe(2400);
  });

  it("không giới hạn nào → null", () => {
    expect(skillBudgetSeconds("listening", {}, false, null)).toBeNull();
  });
});

describe("isSkillTimeUp", () => {
  it("chưa hết giờ", () => {
    expect(isSkillTimeUp(1000, 1800)).toBe(false);
  });

  it("đã hết giờ", () => {
    expect(isSkillTimeUp(1800, 1800)).toBe(true);
  });

  it("còn thiếu trong khoảng epsilon vẫn coi là hết (làm tròn nhịp cuối)", () => {
    expect(isSkillTimeUp(1798, 1800, 3)).toBe(true);
  });
});

describe("AUTO_SUBMIT_SKILLS", () => {
  it("gồm listening/reading/writing, không có speaking", () => {
    expect(AUTO_SUBMIT_SKILLS.has("listening")).toBe(true);
    expect(AUTO_SUBMIT_SKILLS.has("reading")).toBe(true);
    expect(AUTO_SUBMIT_SKILLS.has("writing")).toBe(true);
    expect(AUTO_SUBMIT_SKILLS.has("speaking")).toBe(false);
  });
});

describe("chế độ tổng thời gian cả bài", () => {
  it("totalRemainingSeconds trừ thời gian mọi kỹ năng tính giờ, bỏ qua Speaking", () => {
    expect(totalRemainingSeconds(30, { reading: 600, writing: 120, speaking: 999 })).toBe(1800 - 720);
  });

  it("totalRemainingSeconds không âm", () => {
    expect(totalRemainingSeconds(1, { reading: 500 })).toBe(0);
  });

  it("ngân sách kỹ năng đang mở = tổng − thời gian các kỹ năng KHÁC", () => {
    expect(totalModeBudgetSeconds("writing", 30, { reading: 1320, writing: 60 })).toBe(1800 - 1320);
  });

  it("Speaking không có ngân sách trong chế độ tổng", () => {
    expect(totalModeBudgetSeconds("speaking", 30, { reading: 100 })).toBeNull();
  });

  it("ngân sách không âm khi kỹ năng khác đã ăn hết tổng", () => {
    expect(totalModeBudgetSeconds("writing", 10, { reading: 900 })).toBe(0);
  });

  it("resolveSkillBudgetSeconds ưu tiên tổng khi có totalMinutes", () => {
    expect(
      resolveSkillBudgetSeconds({
        skill: "reading",
        skillLimits: { reading: 99 },
        isMultiSkill: true,
        fallbackMinutes: null,
        totalMinutes: 30,
        elapsedBySkill: { writing: 300 }
      })
    ).toBe(1500);
  });

  it("resolveSkillBudgetSeconds giữ hành vi cũ khi không có totalMinutes", () => {
    expect(
      resolveSkillBudgetSeconds({
        skill: "reading",
        skillLimits: { reading: 20 },
        isMultiSkill: true,
        fallbackMinutes: null,
        totalMinutes: null,
        elapsedBySkill: {}
      })
    ).toBe(1200);
  });
});
