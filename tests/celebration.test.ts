import { describe, expect, it } from "vitest";
import { getCelebration, pickDominantSkill } from "../lib/celebration";

describe("getCelebration", () => {
  it("bài chấm tay -> không pháo hoa, chờ chấm", () => {
    const c = getCelebration({ scorePercent: null, isManualOnly: true, dominantSkill: null });
    expect(c.tier).toBe("manual");
    expect(c.confetti).toBe("none");
  });

  it("điểm < 50 -> động viên, không pháo hoa", () => {
    const c = getCelebration({ scorePercent: 49, isManualOnly: false, dominantSkill: "reading" });
    expect(c.tier).toBe("encourage");
    expect(c.confetti).toBe("none");
  });

  it("điểm 50 -> bậc good, pháo hoa vừa", () => {
    const c = getCelebration({ scorePercent: 50, isManualOnly: false, dominantSkill: "reading" });
    expect(c.tier).toBe("good");
    expect(c.confetti).toBe("medium");
  });

  it("điểm 79 vẫn là good", () => {
    expect(
      getCelebration({ scorePercent: 79, isManualOnly: false, dominantSkill: "reading" }).tier
    ).toBe("good");
  });

  it("điểm 80 -> great, pháo hoa lớn, danh hiệu theo kỹ năng", () => {
    const c = getCelebration({ scorePercent: 80, isManualOnly: false, dominantSkill: "reading" });
    expect(c.tier).toBe("great");
    expect(c.confetti).toBe("big");
    expect(c.title).toContain("Reading");
  });

  it("great không có dominantSkill -> danh hiệu chung", () => {
    const c = getCelebration({ scorePercent: 95, isManualOnly: false, dominantSkill: null });
    expect(c.tier).toBe("great");
    expect(c.title).toBeTruthy();
  });

  it("scorePercent null nhưng không manual -> vẫn xử như manual (an toàn)", () => {
    const c = getCelebration({ scorePercent: null, isManualOnly: false, dominantSkill: null });
    expect(c.tier).toBe("manual");
  });
});

describe("pickDominantSkill", () => {
  it("chọn kỹ năng nhiều câu nhất", () => {
    expect(pickDominantSkill(["reading", "reading", "listening"])).toBe("reading");
  });

  it("hòa -> theo thứ tự chuẩn (listening trước reading)", () => {
    expect(pickDominantSkill(["reading", "listening"])).toBe("listening");
  });

  it("rỗng -> null", () => {
    expect(pickDominantSkill([])).toBeNull();
  });
});
