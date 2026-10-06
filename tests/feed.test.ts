import { describe, expect, it } from "vitest";
import {
  itemEvents,
  mergeFeed,
  parseEventKey,
  prizeEvents,
  rankUpEvents,
  resolveFeedLimit,
  streakMilestoneEvents,
  vocabEvents,
  workEvents,
  type FeedEvent
} from "@/lib/feed";

// Giờ VN = UTC+7. "2026-10-06T03:00:00Z" = 10h sáng 6/10 giờ VN.
const at = (iso: string) => new Date(iso);
const keys = (events: FeedEvent[]) => events.map((event) => event.key).sort();

describe("parseEventKey", () => {
  it("đọc loại + chủ hoạt động", () => {
    expect(parseEventKey("work:s1:a1:2026-10-06")).toEqual({ kind: "work", studentId: "s1" });
    expect(parseEventKey("prize:s2:2026-10")).toEqual({ kind: "prize", studentId: "s2" });
  });

  it("mã lạ → null", () => {
    expect(parseEventKey("hack:s1:x")).toBeNull();
    expect(parseEventKey("work")).toBeNull();
    expect(parseEventKey("work::a1")).toBeNull();
  });
});

describe("workEvents", () => {
  it("gộp kỹ năng cùng lượt cùng ngày, thứ tự L/R/W/S, thời điểm = lần nộp mới nhất", () => {
    const events = workEvents([
      { studentId: "s1", attemptId: "a1", title: "Cam 20 Test 1", practice: false, skill: "reading", submittedAt: at("2026-10-06T05:00:00Z") },
      { studentId: "s1", attemptId: "a1", title: "Cam 20 Test 1", practice: false, skill: "listening", submittedAt: at("2026-10-06T03:00:00Z") }
    ]);
    expect(events).toEqual([
      {
        key: "work:s1:a1:2026-10-06",
        kind: "work",
        studentId: "s1",
        emoji: "📝",
        text: "hoàn thành Listening + Reading · Cam 20 Test 1",
        at: at("2026-10-06T05:00:00Z")
      }
    ]);
  });

  it("qua nửa đêm giờ VN là hoạt động khác; tự luyện có nhãn", () => {
    const events = workEvents([
      { studentId: "s1", attemptId: "a1", title: "Đề A", practice: true, skill: "writing", submittedAt: at("2026-10-05T16:30:00Z") },
      { studentId: "s1", attemptId: "a1", title: "Đề A", practice: true, skill: "speaking", submittedAt: at("2026-10-05T17:30:00Z") }
    ]);
    const byKey = new Map(events.map((event) => [event.key, event.text]));
    expect(byKey.get("work:s1:a1:2026-10-05")).toBe("hoàn thành Writing · Đề A (tự luyện)");
    expect(byKey.get("work:s1:a1:2026-10-06")).toBe("hoàn thành Speaking · Đề A (tự luyện)");
  });

  it("lượt cũ không có kỹ năng → chỉ tên bài", () => {
    const [event] = workEvents([
      { studentId: "s2", attemptId: "a2", title: "Bài cũ", practice: false, skill: null, submittedAt: at("2026-10-01T03:00:00Z") }
    ]);
    expect(event.text).toBe("hoàn thành Bài cũ");
  });
});

describe("streakMilestoneEvents", () => {
  // Học liền 3/10 → 9/10 (7 ngày), riêng 6/10 là ngày cứu bằng Xu.
  const submits = ["03", "04", "05", "07", "08", "09"].map((day) => ({
    studentId: "s1",
    submittedAt: at(`2026-10-${day}T03:00:00Z`)
  }));
  const input = {
    submits,
    vocabDays: [],
    restoreKeys: [{ studentId: "s1", key: "restore-day:2026-10-06" }]
  };

  it("mốc rơi đúng ngày chạm 3 / 7; bỏ mốc 1 ngày (Nhen); ngày cứu không tự sinh mốc", () => {
    const events = streakMilestoneEvents(input, { fromDay: "2026-10-01", toDay: "2026-10-10" });
    expect(events.map((event) => [event.key, event.text])).toEqual([
      ["streak:s1:2026-10-09", "đạt chuỗi 7 ngày — cấp Cháy 🔥"],
      ["streak:s1:2026-10-05", "đạt chuỗi 3 ngày — cấp Bén 🔥"]
    ]);
  });

  it("chỉ lấy mốc trong khoảng ngày yêu cầu", () => {
    expect(keys(streakMilestoneEvents(input, { fromDay: "2026-10-08", toDay: "2026-10-10" }))).toEqual([
      "streak:s1:2026-10-09"
    ]);
  });

  it("ngày chỉ ôn thẻ: thời điểm lấy từ vocabTimes", () => {
    const events = streakMilestoneEvents(
      {
        submits: [],
        vocabDays: ["04", "05", "06"].map((day) => ({ studentId: "s3", date: `2026-10-${day}`, total: 4 })),
        restoreKeys: []
      },
      {
        fromDay: "2026-10-01",
        toDay: "2026-10-10",
        vocabTimes: new Map([["s3|2026-10-06", at("2026-10-06T12:00:00Z")]])
      }
    );
    expect(events[0].at).toEqual(at("2026-10-06T12:00:00Z"));
  });
});

describe("rankUpEvents", () => {
  it("dòng vượt mốc → lên hạng; nhảy 2 cấp chỉ lấy cấp cao; Đồng I không phải sự kiện", () => {
    const events = rankUpEvents(
      [
        { studentId: "s1", amount: 30, createdAt: at("2026-10-01T03:00:00Z") },
        { studentId: "s1", amount: 40, createdAt: at("2026-10-02T03:00:00Z") }, // 70 ≥ 60 → Đồng II
        { studentId: "s1", amount: 200, createdAt: at("2026-10-03T03:00:00Z") } // 270 → vượt 150 và 250 → Đồng IV
      ],
      at("2026-09-01T00:00:00Z")
    );
    expect(events.map((event) => [event.key, event.text])).toEqual([
      ["rank:s1:3", "lên hạng Đồng IV"],
      ["rank:s1:1", "lên hạng Đồng II"]
    ]);
  });

  it("dòng cũ trước `since` vẫn cộng dồn nhưng không sinh sự kiện", () => {
    const events = rankUpEvents(
      [
        { studentId: "s1", amount: 100, createdAt: at("2026-08-01T03:00:00Z") },
        { studentId: "s1", amount: 60, createdAt: at("2026-10-02T03:00:00Z") } // 160 ≥ 150 → Đồng III
      ],
      at("2026-09-22T00:00:00Z")
    );
    expect(keys(events)).toEqual(["rank:s1:2"]);
  });
});

describe("vocabEvents", () => {
  it("chỉ ngày ôn từ 10 thẻ", () => {
    const events = vocabEvents([
      { studentId: "s1", date: "2026-10-06", total: 40, updatedAt: at("2026-10-06T10:00:00Z") },
      { studentId: "s2", date: "2026-10-06", total: 9, updatedAt: at("2026-10-06T10:00:00Z") }
    ]);
    expect(events.map((event) => [event.key, event.text])).toEqual([["vocab:s1:2026-10-06", "ôn 40 thẻ Sổ từ"]]);
  });
});

describe("itemEvents / prizeEvents", () => {
  it("chỉ đồ thành tích + mở bằng chuỗi; đồ mua bỏ qua", () => {
    const events = itemEvents([
      { id: "i1", studentId: "s1", itemKey: "frame:champion@2026-09", source: "achievement", createdAt: at("2026-10-01T00:00:00Z") },
      { id: "i2", studentId: "s1", itemKey: "pose:owl:sleep", source: "streak", createdAt: at("2026-10-02T00:00:00Z") },
      { id: "i3", studentId: "s1", itemKey: "pose:owl:wave", source: "purchase", createdAt: at("2026-10-03T00:00:00Z") }
    ]);
    expect(events.map((event) => [event.key, event.text])).toEqual([
      ["item:s1:i2", "mở tư thế Ngủ gật của Cú Thông Thái"],
      ["item:s1:i1", "nhận Quán quân tháng 9/2026"]
    ]);
  });

  it("thưởng tháng lấy chữ từ ghi chú, không có số Xu", () => {
    const [event] = prizeEvents([
      { studentId: "s1", key: "prize:xp:2026-10", note: "Hạng #1 Học Bá tháng 10/2026", createdAt: at("2026-11-01T05:00:00Z") }
    ]);
    expect(event).toMatchObject({ key: "prize:s1:2026-10", text: "Hạng #1 Học Bá tháng 10/2026 🏆" });
    expect(event.text).not.toMatch(/Xu/);
  });
});

describe("mergeFeed", () => {
  const base = { kind: "vocab" as const, emoji: "📚", text: "x" };
  it("lọc cửa sổ thời gian + tài khoản ẩn, mới nhất trước", () => {
    const events: FeedEvent[] = [
      { ...base, key: "vocab:s1:a", studentId: "s1", at: at("2026-10-05T00:00:00Z") },
      { ...base, key: "vocab:s1:b", studentId: "s1", at: at("2026-10-06T00:00:00Z") },
      { ...base, key: "vocab:s1:c", studentId: "s1", at: at("2026-09-01T00:00:00Z") },
      { ...base, key: "vocab:hide:d", studentId: "hide", at: at("2026-10-06T00:00:00Z") }
    ];
    expect(
      mergeFeed(events, { since: at("2026-09-22T00:00:00Z"), hiddenIds: new Set(["hide"]) }).map((event) => event.key)
    ).toEqual(["vocab:s1:b", "vocab:s1:a"]);
  });
});

describe("resolveFeedLimit", () => {
  it("kẹp về bội số 20 trong [20, 200]", () => {
    expect(resolveFeedLimit(undefined)).toBe(20);
    expect(resolveFeedLimit("abc")).toBe(20);
    expect(resolveFeedLimit("-5")).toBe(20);
    expect(resolveFeedLimit("40")).toBe(40);
    expect(resolveFeedLimit("45")).toBe(60);
    expect(resolveFeedLimit("9999")).toBe(200);
  });
});
