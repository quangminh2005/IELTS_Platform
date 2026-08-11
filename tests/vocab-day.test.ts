import { describe, expect, it } from "vitest";
import { pickNextWord, vietnamDateKey, vietnamDayNumber } from "../lib/vocab-day";

describe("vietnamDateKey", () => {
  it("trả về ngày theo giờ VN", () => {
    expect(vietnamDateKey(new Date("2026-08-11T10:00:00+07:00"))).toBe("2026-08-11");
  });

  it("23h30 giờ VN vẫn là ngày hôm đó dù UTC đã lùi sang hôm trước", () => {
    // 23:30 ngày 11/08 giờ VN == 16:30 ngày 11/08 UTC
    expect(vietnamDateKey(new Date("2026-08-11T16:30:00Z"))).toBe("2026-08-11");
  });

  it("00h30 giờ VN đã sang ngày mới dù UTC còn là hôm trước", () => {
    // 00:30 ngày 12/08 giờ VN == 17:30 ngày 11/08 UTC
    expect(vietnamDateKey(new Date("2026-08-11T17:30:00Z"))).toBe("2026-08-12");
  });
});

describe("vietnamDayNumber", () => {
  it("hai thời điểm cùng ngày VN cho cùng số", () => {
    const a = new Date("2026-08-11T00:30:00+07:00");
    const b = new Date("2026-08-11T23:30:00+07:00");
    expect(vietnamDayNumber(a)).toBe(vietnamDayNumber(b));
  });

  it("ngày kế tiếp tăng đúng 1", () => {
    const a = new Date("2026-08-11T10:00:00+07:00");
    const b = new Date("2026-08-12T10:00:00+07:00");
    expect(vietnamDayNumber(b) - vietnamDayNumber(a)).toBe(1);
  });
});

describe("pickNextWord", () => {
  it("kho rỗng trả về null", () => {
    expect(pickNextWord({ candidates: [], usedIds: [], dayNumber: 5 })).toBeNull();
  });

  it("chỉ chọn trong các từ chưa dùng", () => {
    const picked = pickNextWord({
      candidates: ["a", "b", "c"],
      usedIds: ["a", "c"],
      dayNumber: 7
    });
    expect(picked).toBe("b");
  });

  it("cùng dayNumber luôn cho cùng kết quả", () => {
    const input = { candidates: ["a", "b", "c"], usedIds: [], dayNumber: 4 };
    expect(pickNextWord(input)).toBe(pickNextWord(input));
  });

  it("dùng hết vòng thì xoay lại chứ không trả null", () => {
    const picked = pickNextWord({
      candidates: ["a", "b", "c"],
      usedIds: ["a", "b", "c"],
      dayNumber: 4
    });
    expect(["a", "b", "c"]).toContain(picked);
  });
});
