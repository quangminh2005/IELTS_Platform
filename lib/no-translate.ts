// Logic thuần cho việc chặn công cụ dịch trong vùng làm bài Listening/Reading.
// Không phụ thuộc React/DOM để test thẳng bằng vitest (dự án không cài jsdom),
// cùng lối với lib/proctor-signals.ts.
//
// LƯU Ý: đây chỉ là RÀO CẢN nhắc học sinh giữ luật, KHÔNG phải khoá chống gian
// lận — xem mục "Giới hạn đã biết" trong spec. Trên điện thoại gần như không
// chặn được gì.

// Câu nhắc hiện lên khi học sinh bấm chuột phải. Tiếng Việt CÓ DẤU.
export const NO_TRANSLATE_NOTICE =
  "Không dùng từ điển hay công cụ dịch khi đang làm bài nhé.";

// 3 giây: đủ đọc một câu ngắn mà không che mất đoạn văn quá lâu.
export const NO_TRANSLATE_NOTICE_MS = 3000;

// Chỉ chặn menu chuột phải trên MÁY TÍNH.
//
// Android Chrome cũng bắn `contextmenu` khi nhấn–giữ, mà nhấn–giữ chính là thao
// tác bôi đen để tô màu trên điện thoại. Chặn theo cảm ứng là giết luôn tính
// năng tô màu — nên cứ thấy ngón tay / bút là thả qua.
//
// Không rõ loại con trỏ (chưa có `pointerdown` nào, hoặc trình duyệt cũ không hỗ
// trợ PointerEvent) thì chặn: trường hợp đó gần như chắc chắn là máy tính, và
// bấm phím Menu / Shift+F10 trên bàn phím cũng rơi vào đây.
export function shouldBlockContextMenu(pointerType: string | null): boolean {
  return pointerType !== "touch" && pointerType !== "pen";
}
