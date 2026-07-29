// Bộ câu nhận xét mẫu gợi ý, để ngân hàng nhận xét không rỗng trơn lúc mới dùng.
//
// Viết theo lối giáo viên Việt hay dùng: câu tiếng Việt, giữ nguyên thuật ngữ
// IELTS bằng tiếng Anh. Giáo viên bấm "Thêm bộ gợi ý" một lần rồi tự sửa/xoá.

export type DefaultSnippet = {
  // Khớp với key tiêu chí trong lib/writing-review.ts; null = nhận xét chung.
  criterion: string | null;
  text: string;
};

export const DEFAULT_COMMENT_SNIPPETS: DefaultSnippet[] = [
  {
    criterion: "taskAchievement",
    text: "Bài chưa đủ số từ tối thiểu nên bị trừ Task Achievement."
  },
  {
    criterion: "taskAchievement",
    text: "Task 1 thiếu câu overview — bắt buộc phải có một câu nêu xu hướng chính."
  },
  {
    criterion: "taskAchievement",
    text: "Chưa trả lời hết các phần của đề bài, còn bỏ sót một vế."
  },
  {
    criterion: "coherence",
    text: "Ý tưởng ổn nhưng các câu còn rời rạc, cần thêm từ nối."
  },
  {
    criterion: "coherence",
    text: "Nên tách đoạn rõ ràng: mỗi đoạn một ý chính kèm câu chủ đề."
  },
  {
    criterion: "lexicalResource",
    text: "Lặp lại từ vựng nhiều lần, nên dùng từ đồng nghĩa để nâng Lexical Resource."
  },
  {
    criterion: "lexicalResource",
    text: "Một số collocation chưa tự nhiên, xem lại cách kết hợp từ."
  },
  {
    criterion: "grammar",
    text: "Chủ yếu là câu đơn — cần thêm câu phức để nâng Grammatical Range."
  },
  {
    criterion: "grammar",
    text: "Lỗi chia thì và số ít/số nhiều lặp lại ở nhiều câu."
  },
  {
    criterion: "grammar",
    text: "Dùng sai mạo từ (a/an/the) ở nhiều chỗ."
  },
  {
    criterion: "fluency",
    text: "Còn ngập ngừng và lặp lại nhiều, cần luyện nói liền mạch hơn."
  },
  {
    criterion: "pronunciation",
    text: "Phát âm đuôi từ (-s, -ed) chưa rõ, người nghe dễ hiểu nhầm."
  },
  {
    criterion: null,
    text: "Bài có tiến bộ rõ so với lần trước, giữ nhịp này nhé."
  },
  {
    criterion: null,
    text: "Đọc lại bài trước khi nộp để bắt các lỗi nhỏ, sẽ lên được nửa band."
  }
];
