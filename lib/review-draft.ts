// Bản nháp phiếu chấm lưu tạm trong localStorage.
//
// Vì sao cần: form chấm khá dài (2 task × 4 tiêu chí + 2 ô nhận xét) và giáo
// viên hay vừa đọc bài vừa gõ. Lỡ đóng tab / mất mạng giữa chừng mà chưa bấm Lưu
// thì mất sạch. Nháp được ghi lại sau mỗi lần gõ và tự khôi phục khi mở lại.

export type ReviewDraft = {
  // Mốc thời gian ghi nháp (ms). Dùng để so với lần chấm đã lưu trên máy chủ.
  savedAt: number;
  scores: Record<string, Record<string, string>>;
  overallBand: string;
  summaryFeedback: string;
  detailedFeedback: string;
};

export function reviewDraftKey(attemptId: string): string {
  return `review-draft:${attemptId}`;
}

// Chỉ khôi phục nháp khi nó MỚI HƠN lần chấm đã lưu. Nếu đã bấm Lưu rồi thì bản
// trên máy chủ mới là bản đúng — nháp cũ còn sót lại phải bỏ đi, nếu không mỗi
// lần mở bài đã chấm lại thấy nội dung cũ đè lên.
export function shouldRestoreDraft(
  draft: ReviewDraft | null,
  reviewedAt: string | Date | null | undefined
): boolean {
  if (!draft || typeof draft.savedAt !== "number" || !Number.isFinite(draft.savedAt)) {
    return false;
  }

  if (!reviewedAt) {
    return true;
  }

  const reviewedTime = new Date(reviewedAt).getTime();

  return Number.isFinite(reviewedTime) ? draft.savedAt > reviewedTime : true;
}

export function parseReviewDraft(raw: string | null): ReviewDraft | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ReviewDraft>;

    if (typeof parsed?.savedAt !== "number") {
      return null;
    }

    const scores: ReviewDraft["scores"] = {};
    for (const [unitId, raw] of Object.entries(parsed.scores ?? {})) {
      if (raw && typeof raw === "object") {
        const row: Record<string, string> = {};
        for (const [key, value] of Object.entries(raw)) {
          row[key] = String(value);
        }
        scores[unitId] = row;
      }
    }

    return {
      savedAt: parsed.savedAt,
      scores,
      overallBand: String(parsed.overallBand ?? ""),
      summaryFeedback: String(parsed.summaryFeedback ?? ""),
      detailedFeedback: String(parsed.detailedFeedback ?? "")
    };
  } catch {
    return null;
  }
}

// Ký tự ngăn cách giữa các trường khi ghép dấu vân tay. Dùng ký tự điều khiển
// vì nó không bao giờ có trong chữ giáo viên gõ — nếu ngăn bằng dấu thường thì
// gõ đúng dấu đó vào ô nhận xét có thể làm hai nội dung khác nhau ra cùng vân tay.
// Tạo bằng fromCharCode chứ KHÔNG dán ký tự thật vào file: một byte NUL thật sẽ
// làm git coi cả file là nhị phân (mất diff, mất merge).
const FIELD_SEPARATOR = String.fromCharCode(0);

// Dấu vân tay của nội dung phiếu chấm, dùng để so "đang gõ" với "đã lưu".
//
// Phải sắp khoá trước khi nối chuỗi: điểm seed từ bản đã lưu có thứ tự khoá khác
// với điểm vừa bấm tay, JSON.stringify thẳng sẽ ra hai chuỗi khác nhau dù nội
// dung y hệt. Ô để trống bị loại luôn vì "chưa chấm" và "không có khoá" là một.
export function draftFingerprint(draft: Omit<ReviewDraft, "savedAt">): string {
  const scores = Object.keys(draft.scores)
    .sort()
    .map((unitId) => {
      const row = draft.scores[unitId] ?? {};
      const inner = Object.keys(row)
        .sort()
        .filter((key) => row[key] !== "")
        .map((key) => `${key}=${row[key]}`)
        .join(",");

      return `${unitId}:{${inner}}`;
    })
    .join("|");

  return [
    scores,
    draft.overallBand.trim(),
    draft.summaryFeedback.trim(),
    draft.detailedFeedback.trim()
  ].join(FIELD_SEPARATOR);
}
