"use client";

import { Fragment, type ReactNode } from "react";

// Dựng lại toàn bộ nội dung con mỗi khi `token` đổi. Token đổi sau mỗi lần tạo
// bài thành công (server action redirect kèm token mới), nên form "Tạo bài
// giao" được remount → xoá sạch mọi ô đã tích / đã nhập cho lần giao kế tiếp.
//
// Key nằm ở RANH GIỚI CLIENT (component "use client" này) nên chắc chắn remount
// các picker con — khác với đặt key trên Server Component ở trang, vốn không
// đáng tin khi điều hướng mềm sau server action. Fragment không tạo thẻ DOM nên
// không ảnh hưởng layout (sticky, grid… giữ nguyên).
export function ResetOnToken({ token, children }: { token: string; children: ReactNode }) {
  return <Fragment key={token}>{children}</Fragment>;
}
