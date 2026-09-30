import { z } from "zod";

// Loại tài liệu trong Kho: sách/bộ đề in sẵn hoặc bài tập hàng tuần.
export const MATERIAL_CATEGORIES = ["book", "homework"] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

// Tên kệ cho đề thuộc loại sách nhưng chưa ghi tên sách.
export const UNNAMED_SHELF = "Chưa đặt tên sách";

const categorySchema = z.enum(MATERIAL_CATEGORIES).catch("homework");

// Chuẩn hoá cặp (loại, tên sách) từ FormData/JSON. Bài tập hàng tuần không có tên sách.
export function normalizeCategoryFields(input: { category?: unknown; bookName?: unknown }): {
  category: MaterialCategory;
  bookName: string | null;
} {
  const category = categorySchema.parse(input.category);
  if (category === "homework") return { category, bookName: null };
  const name =
    typeof input.bookName === "string" ? input.bookName.replace(/\s+/g, " ").trim() : "";
  return { category, bookName: name || null };
}
