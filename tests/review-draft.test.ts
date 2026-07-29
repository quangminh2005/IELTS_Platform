import { describe, expect, it } from "vitest";
import {
  draftFingerprint,
  parseReviewDraft,
  reviewDraftKey,
  shouldRestoreDraft,
  type ReviewDraft
} from "../lib/review-draft";

function draft(overrides: Partial<ReviewDraft> = {}): ReviewDraft {
  return {
    savedAt: 1_000_000,
    scores: { u1: { taskAchievement: "6" } },
    overallBand: "6",
    summaryFeedback: "Tốt",
    detailedFeedback: "",
    ...overrides
  };
}

describe("reviewDraftKey", () => {
  it("tách theo từng bài làm", () => {
    expect(reviewDraftKey("abc")).toBe("review-draft:abc");
    expect(reviewDraftKey("abc")).not.toBe(reviewDraftKey("xyz"));
  });
});

describe("shouldRestoreDraft", () => {
  it("bài chưa chấm lần nào thì luôn khôi phục", () => {
    expect(shouldRestoreDraft(draft(), null)).toBe(true);
    expect(shouldRestoreDraft(draft(), undefined)).toBe(true);
  });

  it("nháp mới hơn lần chấm đã lưu → khôi phục", () => {
    expect(shouldRestoreDraft(draft({ savedAt: 2000 }), new Date(1000))).toBe(true);
  });

  it("nháp cũ hơn lần chấm đã lưu → bỏ, tránh đè nội dung đã lưu", () => {
    expect(shouldRestoreDraft(draft({ savedAt: 1000 }), new Date(2000))).toBe(false);
    expect(shouldRestoreDraft(draft({ savedAt: 2000 }), new Date(2000))).toBe(false);
  });

  it("nhận cả chuỗi ngày ISO", () => {
    expect(shouldRestoreDraft(draft({ savedAt: 5000 }), new Date(1000).toISOString())).toBe(true);
  });

  it("không có nháp hoặc nháp hỏng thì thôi", () => {
    expect(shouldRestoreDraft(null, null)).toBe(false);
    expect(shouldRestoreDraft({ ...draft(), savedAt: NaN }, null)).toBe(false);
  });
});

describe("parseReviewDraft", () => {
  it("đọc lại đúng nội dung đã ghi", () => {
    const original = draft();
    expect(parseReviewDraft(JSON.stringify(original))).toEqual(original);
  });

  it("ép điểm về chuỗi để khớp value của nút chọn", () => {
    const parsed = parseReviewDraft(
      JSON.stringify({ savedAt: 1, scores: { u1: { grammar: 6.5 } } })
    );
    expect(parsed?.scores).toEqual({ u1: { grammar: "6.5" } });
    expect(parsed?.summaryFeedback).toBe("");
  });

  it("chịu được rỗng / hỏng / thiếu mốc thời gian", () => {
    expect(parseReviewDraft(null)).toBeNull();
    expect(parseReviewDraft("")).toBeNull();
    expect(parseReviewDraft("không phải json")).toBeNull();
    expect(parseReviewDraft('{"scores":{}}')).toBeNull();
  });
});

describe("draftFingerprint", () => {
  const body = { overallBand: "6", summaryFeedback: "Tốt", detailedFeedback: "" };

  it("KHÔNG phụ thuộc thứ tự khoá — điểm seed và điểm bấm tay phải khớp nhau", () => {
    expect(
      draftFingerprint({ ...body, scores: { u1: { grammar: "6", coherence: "5" } } })
    ).toBe(draftFingerprint({ ...body, scores: { u1: { coherence: "5", grammar: "6" } } }));
  });

  it("ô để trống coi như chưa chấm, bằng với không có khoá", () => {
    expect(draftFingerprint({ ...body, scores: { u1: { grammar: "" } } })).toBe(
      draftFingerprint({ ...body, scores: { u1: {} } })
    );
  });

  it("chưa gõ gì thì trùng với bản rỗng — mở bài ra xem không sinh nháp", () => {
    const untouched = {
      scores: { u1: { taskAchievement: "", coherence: "" } },
      overallBand: "",
      summaryFeedback: "",
      detailedFeedback: ""
    };
    expect(draftFingerprint(untouched)).toBe(
      draftFingerprint({ scores: { u1: {} }, overallBand: "", summaryFeedback: "", detailedFeedback: "" })
    );
  });

  it("đổi bất kỳ điểm hay chữ nào là đổi vân tay", () => {
    const base = draftFingerprint({ ...body, scores: { u1: { grammar: "6" } } });
    expect(draftFingerprint({ ...body, scores: { u1: { grammar: "6.5" } } })).not.toBe(base);
    expect(draftFingerprint({ ...body, scores: { u2: { grammar: "6" } } })).not.toBe(base);
    expect(
      draftFingerprint({ ...body, summaryFeedback: "Khá", scores: { u1: { grammar: "6" } } })
    ).not.toBe(base);
    expect(
      draftFingerprint({ ...body, detailedFeedback: "x", scores: { u1: { grammar: "6" } } })
    ).not.toBe(base);
  });

  it("bỏ qua khoảng trắng thừa hai đầu", () => {
    expect(draftFingerprint({ ...body, summaryFeedback: " Tốt ", scores: {} })).toBe(
      draftFingerprint({ ...body, summaryFeedback: "Tốt", scores: {} })
    );
  });
});
