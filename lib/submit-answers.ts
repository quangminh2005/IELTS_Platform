// Bù đáp án còn thiếu vào FormData nộp bài từ state `answers` của phòng làm bài.
//
// VÌ SAO CẦN: phòng làm bài chỉ dựng DOM cho part/bước ĐANG MỞ (commit 864cec1a,
// để phòng xem trước 40 unit không bị khựng). Form nộp `<form action={submitSkill}>`
// chỉ gom được input đang có trong DOM, còn submitSkill thì xoá nháp rồi ghi lại
// đúng những gì form gửi → ngày 17/09/2026 hai học viên nộp bài Listening 6 part
// chỉ còn part đang mở, mất 20/28 câu. State `answers` luôn đủ (mọi input đều báo
// lên handleAnswerChange, tự lưu nháp cũng đọc từ đó) nên lấy nó bù vào.
//
// Chỉ bù câu CHƯA có trong FormData: input đang hiện trên màn hình là giá trị mới
// nhất, không ghi đè. Trả về số câu đã bù để tiện ghi log/kiểm tra.
export function fillMissingAnswers(
  formData: FormData,
  answers: Record<string, string>
): number {
  let filled = 0;
  for (const [questionId, value] of Object.entries(answers)) {
    const key = `q_${questionId}`;
    if (formData.has(key)) {
      continue;
    }
    formData.set(key, value);
    filled += 1;
  }
  return filled;
}
