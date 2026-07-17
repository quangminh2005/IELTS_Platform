import { describe, expect, it } from "vitest";
import {
  TAB_AWAY_MIN_MS,
  hasProctorFlag,
  isFindShortcut,
  mergeCount,
  proctorSummary,
  shouldCountTabAway
} from "@/lib/proctor-signals";

describe("isFindShortcut", () => {
  it("nhận diện Ctrl+F (Windows/Linux)", () => {
    expect(isFindShortcut({ key: "f", ctrlKey: true, metaKey: false })).toBe(true);
  });

  it("nhận diện Cmd+F (macOS)", () => {
    expect(isFindShortcut({ key: "f", ctrlKey: false, metaKey: true })).toBe(true);
  });

  it("nhận diện chữ F viết hoa (khi bật Caps Lock / giữ Shift)", () => {
    expect(isFindShortcut({ key: "F", ctrlKey: true, metaKey: false })).toBe(true);
  });

  it("nhận diện F3", () => {
    expect(isFindShortcut({ key: "F3", ctrlKey: false, metaKey: false })).toBe(true);
  });

  it("bỏ qua phím F trần (học viên đang gõ đáp án)", () => {
    expect(isFindShortcut({ key: "f", ctrlKey: false, metaKey: false })).toBe(false);
  });

  it("bỏ qua Ctrl kèm phím khác", () => {
    expect(isFindShortcut({ key: "c", ctrlKey: true, metaKey: false })).toBe(false);
  });
});

describe("shouldCountTabAway", () => {
  it("không tính khi rời tab ngắn hơn mốc", () => {
    expect(shouldCountTabAway(TAB_AWAY_MIN_MS - 1)).toBe(false);
  });

  it("tính khi rời tab đúng bằng mốc", () => {
    expect(shouldCountTabAway(TAB_AWAY_MIN_MS)).toBe(true);
  });

  it("tính khi rời tab lâu hơn mốc", () => {
    expect(shouldCountTabAway(TAB_AWAY_MIN_MS + 1)).toBe(true);
  });

  it("bỏ qua giá trị rác", () => {
    expect(shouldCountTabAway(Number.NaN)).toBe(false);
    expect(shouldCountTabAway(-5000)).toBe(false);
  });
});

describe("hasProctorFlag", () => {
  it("không bật cờ khi cả hai bằng 0", () => {
    expect(hasProctorFlag({ tabSwitchCount: 0, findAttemptCount: 0 })).toBe(false);
  });

  it("bật cờ khi chỉ có rời tab", () => {
    expect(hasProctorFlag({ tabSwitchCount: 1, findAttemptCount: 0 })).toBe(true);
  });

  it("bật cờ khi chỉ có Ctrl+F", () => {
    expect(hasProctorFlag({ tabSwitchCount: 0, findAttemptCount: 1 })).toBe(true);
  });
});

describe("mergeCount", () => {
  it("lấy giá trị lớn hơn", () => {
    expect(mergeCount(3, 7)).toBe(7);
  });

  it("không bao giờ kéo lùi số đã lưu", () => {
    expect(mergeCount(7, 3)).toBe(7);
  });

  it("coi giá trị rác là 0", () => {
    expect(mergeCount(5, Number.NaN)).toBe(5);
    expect(mergeCount(5, -2)).toBe(5);
    expect(mergeCount(Number.NaN, 4)).toBe(4);
  });

  it("làm tròn xuống số lẻ", () => {
    expect(mergeCount(0, 2.9)).toBe(2);
  });
});

describe("proctorSummary", () => {
  it("báo sạch khi không có dấu hiệu", () => {
    expect(proctorSummary({ tabSwitchCount: 0, findAttemptCount: 0 })).toBe(
      "Không ghi nhận dấu hiệu bất thường"
    );
  });

  it("liệt kê số đếm khi có dấu hiệu", () => {
    expect(proctorSummary({ tabSwitchCount: 3, findAttemptCount: 5 })).toBe(
      "Rời tab: 3 lần · Thử Ctrl+F: 5 lần"
    );
  });
});
