// Quyết định cách ghi đáp án nháp (heartbeat tự lưu) — tách riêng khỏi Prisma để
// test được bằng vitest.
//
// Bối cảnh: nhịp tự lưu trước đây XOÁ SẠCH đáp án của attempt rồi chép lại từ
// state của trình duyệt. Chỉ cần một nhịp chạy lúc state rỗng (component mount
// lại nên quay về màn "Kiểm tra âm thanh", hoặc Router Cache trả payload cũ từ
// lúc mới vào phòng thi) là toàn bộ bài làm bay vĩnh viễn — đã xảy ra thật ngày
// 24/07/2026, một học sinh làm đủ 28 phút mà bị chấm 0% với 40 câu trống.
//
// Hai lớp bảo vệ ở đây:
//   1. Chỉ đụng vào những câu client THỰC SỰ gửi lên. Câu không có trong payload
//      nghĩa là client không biết gì về nó, không được suy ra là "bỏ trống".
//   2. Nếu client báo trống hết mà DB đang có bài làm thì bỏ qua cả lượt lưu —
//      coi như payload cũ/không đáng tin.

export type DraftAnswerRow = {
  questionId: string;
  assignableUnitId: string;
  value: string;
};

export type DraftWritePlan = {
  /** true = bỏ qua hoàn toàn phần ghi đáp án (vẫn lưu giờ/tín hiệu gian lận). */
  skip: boolean;
  /** Chỉ xoá đáp án cũ của đúng những câu này. */
  deleteQuestionIds: string[];
  /** Các câu có nội dung, ghi lại sau khi xoá. */
  createRows: DraftAnswerRow[];
};

const EMPTY_PLAN: DraftWritePlan = { skip: true, deleteQuestionIds: [], createRows: [] };

export function planDraftWrite({
  sent,
  savedNonEmptyCount
}: {
  sent: DraftAnswerRow[];
  savedNonEmptyCount: number;
}): DraftWritePlan {
  // Lớp 1: client không gửi câu nào → không có gì để nói về đáp án.
  if (sent.length === 0) {
    return EMPTY_PLAN;
  }

  const createRows = sent.filter((row) => row.value !== "");

  // Lớp 2: "trống hết" trong khi DB đang có bài làm → payload không đáng tin.
  // (Bài mới chưa làm câu nào thì savedNonEmptyCount = 0, vẫn lưu bình thường để
  // học sinh xoá đáp án vừa gõ vẫn có hiệu lực.)
  if (createRows.length === 0 && savedNonEmptyCount > 0) {
    return EMPTY_PLAN;
  }

  return {
    skip: false,
    deleteQuestionIds: sent.map((row) => row.questionId),
    createRows
  };
}
