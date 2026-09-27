// Lọc câu trả lời được phép hiện ở trang Kết quả của học viên.
//
// VÌ SAO CẦN: bảng Answer chứa cả bản NHÁP tự lưu của kỹ năng đang làm dở. Trang
// Kết quả gửi kèm dẫn chứng (Question.answerEvidence) và transcript Listening
// xuống trình duyệt — nếu không lọc, bài nhiều kỹ năng mới nộp một kỹ năng thì học
// viên chỉ cần mở trang Kết quả (bỏ ?skill= khỏi địa chỉ) là thấy dẫn chứng của các
// câu đang làm. Chỉ kỹ năng ĐÃ NỘP mới được hiện; lượt đã nộp hẳn thì hiện hết.

type SkillRow = { skill: string; status: string };
type AnswerWithSkill = { assignableUnit: { skill: string } };

export function visibleResultAnswers<T extends AnswerWithSkill>(
  attemptStatus: string,
  skills: SkillRow[],
  answers: T[]
): T[] {
  if (attemptStatus === "submitted") {
    return answers;
  }

  const submitted = new Set(
    skills.filter((row) => row.status === "submitted").map((row) => row.skill)
  );

  return answers.filter((answer) => submitted.has(answer.assignableUnit.skill));
}
