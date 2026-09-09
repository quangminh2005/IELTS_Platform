import { describe, expect, it } from "vitest";
import {
  LATE_COMPLETION_WEIGHT,
  completionWeight,
  isSubmissionLate
} from "@/lib/late-submission";

const deadline = new Date("2026-07-05T23:59:00+07:00");

describe("isSubmissionLate", () => {
  it("thiếu mốc nộp hoặc hạn nộp -> không tính là trễ", () => {
    expect(isSubmissionLate(null, deadline)).toBe(false);
    expect(isSubmissionLate(new Date("2026-07-09T08:00:00+07:00"), null)).toBe(false);
    expect(isSubmissionLate(null, null)).toBe(false);
  });

  it("nộp trước hạn -> không trễ", () => {
    expect(isSubmissionLate(new Date("2026-07-05T20:00:00+07:00"), deadline)).toBe(false);
  });

  it("nộp đúng khoảnh khắc hết hạn -> vẫn kịp", () => {
    expect(isSubmissionLate(deadline, deadline)).toBe(false);
  });

  it("nộp sau hạn -> trễ", () => {
    expect(isSubmissionLate(new Date("2026-07-06T00:00:00+07:00"), deadline)).toBe(true);
  });

  it("nhận cả chuỗi ISO lẫn Date", () => {
    expect(isSubmissionLate("2026-07-06T08:00:00+07:00", deadline.toISOString())).toBe(true);
  });
});

describe("completionWeight", () => {
  it("chưa nộp -> 0", () => {
    expect(completionWeight({ status: "assigned", submittedAt: null, deadline })).toBe(0);
    expect(completionWeight({ status: "in_progress", submittedAt: null, deadline })).toBe(0);
  });

  it("nộp đúng hạn -> trọn suất", () => {
    expect(
      completionWeight({
        status: "submitted",
        submittedAt: new Date("2026-07-05T20:00:00+07:00"),
        deadline
      })
    ).toBe(1);
  });

  it("bài không đặt hạn -> luôn trọn suất", () => {
    expect(
      completionWeight({
        status: "reviewed",
        submittedAt: new Date("2026-07-30T20:00:00+07:00"),
        deadline: null
      })
    ).toBe(1);
  });

  it("nộp trễ -> nửa suất", () => {
    expect(
      completionWeight({
        status: "submitted",
        submittedAt: new Date("2026-07-06T08:00:00+07:00"),
        deadline
      })
    ).toBe(LATE_COMPLETION_WEIGHT);
    expect(LATE_COMPLETION_WEIGHT).toBe(0.5);
  });
});
