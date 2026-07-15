// Kết quả server action trả về cho giao diện để bắn toast báo thành công/thất bại.
// Thuần dữ liệu, không dính React — dùng được cả ở server action lẫn client component.
export type ActionResult = {
  ok: boolean;
  message: string;
};

export function actionOk(message: string): ActionResult {
  return { ok: true, message };
}

// Ghép "<prefix> thất bại: <lý do>". Chỉ tin thông điệp của Error thật; thứ khác
// (chuỗi ném thẳng, object lạ, undefined) dùng câu mặc định để không đẩy nội dung
// khó hiểu ra trước mặt giáo viên.
export function actionFail(error: unknown, prefix: string): ActionResult {
  const reason =
    error instanceof Error && error.message.trim().length > 0
      ? error.message.trim()
      : "Có lỗi không xác định.";

  return { ok: false, message: `${prefix} thất bại: ${reason}` };
}
