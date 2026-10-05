// Công thức XP của Tổng kết tháng (kiểu "Bá khí" của chin.edu.vn). Mọi hệ số
// nằm ở đây — muốn chỉnh XP thì chỉ sửa file này.
//
// Tính theo PHẦN (AssignableUnit) chứ không theo câu: bài chép chính tả LPTD có
// 80–200 ô/unit, tính theo câu sẽ cho XP gấp nhiều lần một passage 13 câu dù
// thời gian làm tương đương.

// Phần tự chấm: XP nền khi nộp + tối đa chừng này XP theo % đúng.
export const XP_UNIT_BASE = 10;
export const XP_UNIT_ACCURACY_MAX = 10;
// Phần chấm tay (Writing task / Speaking) có bài làm — cộng ngay khi nộp.
export const XP_MANUAL_UNIT = 20;
// Ôn Sổ từ: 1 XP cho mỗi chừng này thẻ, trần mỗi ngày.
export const XP_VOCAB_CARDS_PER_POINT = 2;
export const XP_VOCAB_DAILY_CAP = 15;
// Lượt tự luyện thứ 2 trở đi (đã biết đáp án) chỉ được một phần XP.
export const XP_RETRY_FACTOR = 0.5;
// Phần Nghe làm ở chế độ ẩn thanh audio (nghe một lượt, không tua/dừng như thi thật)
// được nhân XP — và Xu ăn theo XP nên cũng được nhân theo.
export const XP_HIDDEN_AUDIO_FACTOR = 1.5;

export type UnitXpInput = {
  gradedCount: number; // số câu tự chấm đã có kết quả đúng/sai
  correctCount: number;
  manualAnswered: boolean; // có ít nhất một câu chấm tay không để trống
  attemptRound: number;
  // Chỉ true với phần Nghe của lượt tự luyện có ẩn thanh audio (Attempt.audioHidden).
  audioHidden?: boolean;
};

export function unitXp(input: UnitXpInput): number {
  let xp = 0;

  if (input.gradedCount > 0) {
    xp += XP_UNIT_BASE + Math.round((XP_UNIT_ACCURACY_MAX * input.correctCount) / input.gradedCount);
  }

  if (input.manualAnswered) {
    xp += XP_MANUAL_UNIT;
  }

  if (input.audioHidden) {
    xp = Math.floor(xp * XP_HIDDEN_AUDIO_FACTOR);
  }

  return input.attemptRound >= 2 ? Math.floor(xp * XP_RETRY_FACTOR) : xp;
}

export function vocabDayXp(cards: number): number {
  return Math.min(XP_VOCAB_DAILY_CAP, Math.floor(Math.max(0, cards) / XP_VOCAB_CARDS_PER_POINT));
}
