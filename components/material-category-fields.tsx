import type { MaterialCategory } from "@/lib/material-category";

// Một <datalist> dùng chung cả trang — tránh lặp 149 bản cho 149 form sửa.
export function BookNameDatalist({ id, bookNames }: { id: string; bookNames: string[] }) {
  return (
    <datalist id={id}>
      {bookNames.map((name) => (
        <option key={name} value={name} />
      ))}
    </datalist>
  );
}

// Ô "Loại tài liệu" + "Tên sách" dùng chung cho form tạo, nhập JSON và sửa tài liệu.
export function MaterialCategoryFields({
  idPrefix,
  listId,
  defaultCategory = "homework",
  defaultBookName,
  fieldClass
}: {
  idPrefix: string;
  listId: string;
  defaultCategory?: MaterialCategory;
  defaultBookName?: string | null;
  fieldClass: string;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <label className="text-sm font-medium" htmlFor={`${idPrefix}-category`}>
          Loại tài liệu
        </label>
        <select
          id={`${idPrefix}-category`}
          name="category"
          defaultValue={defaultCategory}
          className={fieldClass}
        >
          <option value="homework">Bài tập hàng tuần</option>
          <option value="book">Sách / bộ đề</option>
        </select>
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor={`${idPrefix}-book`}>
          Tên sách <span className="text-muted-foreground">(chỉ cần với Sách / bộ đề)</span>
        </label>
        <input
          id={`${idPrefix}-book`}
          name="bookName"
          list={listId}
          defaultValue={defaultBookName ?? ""}
          placeholder="IELTS Master – Listening"
          className={fieldClass}
        />
      </div>
    </div>
  );
}
