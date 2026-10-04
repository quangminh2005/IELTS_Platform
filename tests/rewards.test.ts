import { describe, expect, it } from "vitest";
import {
  REDEMPTION_STATUS_LABELS,
  redeemKey,
  refundKey,
  remainingStock,
  rewardCardState,
  studentLimitReached
} from "../lib/rewards";

describe("quà — số lượng còn", () => {
  it("không giới hạn → null", () => {
    expect(remainingStock(null, 7)).toBeNull();
  });

  it("còn = tổng − phiếu đang giữ, không âm", () => {
    expect(remainingStock(5, 2)).toBe(3);
    expect(remainingStock(2, 3)).toBe(0);
  });
});

describe("quà — giới hạn mỗi em", () => {
  const now = new Date("2026-10-04T10:00:00+07:00");

  it("không đặt giới hạn → không chặn", () => {
    expect(
      studentLimitReached({ limitPerStudent: null, limitPeriod: "month", redemptionDates: [now, now], now })
    ).toBe(false);
  });

  it("theo tháng: chỉ đếm phiếu trong tháng VN hiện tại", () => {
    const lastMonth = new Date("2026-09-30T23:30:00+07:00");
    const firstMinute = new Date("2026-10-01T00:05:00+07:00");
    expect(
      studentLimitReached({ limitPerStudent: 1, limitPeriod: "month", redemptionDates: [lastMonth], now })
    ).toBe(false);
    expect(
      studentLimitReached({ limitPerStudent: 1, limitPeriod: "month", redemptionDates: [firstMinute], now })
    ).toBe(true);
  });

  it("mãi mãi: đếm mọi phiếu", () => {
    const longAgo = new Date("2026-01-15T10:00:00+07:00");
    expect(
      studentLimitReached({ limitPerStudent: 2, limitPeriod: "ever", redemptionDates: [longAgo], now })
    ).toBe(false);
    expect(
      studentLimitReached({ limitPerStudent: 2, limitPeriod: "ever", redemptionDates: [longAgo, now], now })
    ).toBe(true);
  });
});

describe("quà — trạng thái thẻ", () => {
  const base = { active: true, price: 100, coins: 150, remaining: 3, limitReached: false };

  it("đủ điều kiện → đổi được", () => {
    expect(rewardCardState(base)).toBe("redeemable");
    expect(rewardCardState({ ...base, remaining: null })).toBe("redeemable");
  });

  it("thứ tự ưu tiên: ẩn > hết hàng > đạt giới hạn > thiếu Xu", () => {
    expect(rewardCardState({ ...base, active: false, remaining: 0 })).toBe("inactive");
    expect(rewardCardState({ ...base, remaining: 0, limitReached: true, coins: 0 })).toBe("sold_out");
    expect(rewardCardState({ ...base, limitReached: true, coins: 0 })).toBe("limit");
    expect(rewardCardState({ ...base, coins: 99 })).toBe("short");
  });
});

describe("quà — khoá sổ + nhãn", () => {
  it("khoá sổ theo phiếu", () => {
    expect(redeemKey("abc")).toBe("reward:abc");
    expect(refundKey("abc")).toBe("refund:abc");
  });

  it("đủ nhãn cho 4 trạng thái", () => {
    expect(Object.keys(REDEMPTION_STATUS_LABELS).sort()).toEqual(["cancelled", "delivered", "pending", "rejected"]);
  });
});
