"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { matchesSearch, toggleClassChip } from "@/lib/assignment-wizard";

export type StudentPickerStudent = {
  id: string;
  displayName: string;
  email: string;
  classNames: string[];
  classIds: string[];
};

export type StudentPickerClass = {
  id: string;
  name: string;
};

type StudentPickerProps = {
  students: StudentPickerStudent[];
  classOptions: StudentPickerClass[];
  selectedStudentIds?: string[];
  compact?: boolean;
  // Bố cục rộng cho modal giao bài: chip lớp + ô tìm + danh sách 2 cột.
  wide?: boolean;
};

export function StudentPicker({
  students,
  classOptions,
  selectedStudentIds,
  compact = false,
  wide = false
}: StudentPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(selectedStudentIds ?? [])
  );
  const [query, setQuery] = useState("");
  // Neo trên phần tử gốc để bắn sự kiện "change" nổi bọt lên <form> cha.
  const rootRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  // Chip lớp và "Chọn tất cả"/"Bỏ chọn tất cả" đổi tick bằng React state
  // (setSelected) nên trình duyệt KHÔNG tự bắn sự kiện "change" như khi người
  // dùng tick tay từng checkbox — bộ đếm học viên ở AssignmentWizard (nghe
  // "change" trên <form>) sẽ đứng im dù danh sách chọn đã đổi. Bắn thủ công
  // một sự kiện "change" nổi bọt sau mỗi lần `selected` đổi, giống cách
  // UnitPickerTest đã làm cho nút "Chọn tất cả" ở bước 1.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    rootRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
  }, [selected]);

  const allSelected = students.length > 0 && selected.size === students.length;

  const studentsByClass = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const student of students) {
      for (const classId of student.classIds) {
        const list = map[classId] ?? [];
        list.push(student.id);
        map[classId] = list;
      }
    }
    return map;
  }, [students]);

  // Chip lớp nào đang bật (chỉ dùng ở chế độ wide) — SUY ra từ danh sách đang
  // chọn mỗi lần render, không lưu state riêng: một lớp coi là "đang bật" khi
  // mọi học viên của lớp đó đều đang được chọn (lớp rỗng thì không bao giờ
  // tính là đang bật). Nhờ vậy chip không thể lệch màu với danh sách tick tay.
  const activeClassIds = useMemo(() => {
    return classOptions
      .filter((classItem) => {
        const ids = studentsByClass[classItem.id] ?? [];
        return ids.length > 0 && ids.every((id) => selected.has(id));
      })
      .map((classItem) => classItem.id);
  }, [classOptions, studentsByClass, selected]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(students.map((s) => s.id)));
  }

  function selectClass(classId: string) {
    if (!classId) {
      return;
    }
    const ids = studentsByClass[classId] ?? [];
    setSelected((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }

  // Chip lớp (chế độ wide): học viên có thể thuộc nhiều lớp, nên bỏ chip của
  // một lớp chỉ được gỡ những học viên không còn thuộc lớp nào khác đang bật —
  // logic thật nằm ở hàm thuần toggleClassChip (lib/assignment-wizard.ts) để
  // test được.
  function handleClassChipClick(classId: string) {
    const result = toggleClassChip({
      selected: Array.from(selected),
      activeClassIds,
      classId,
      studentsByClass
    });
    // Chỉ cần lấy phần selected — activeClassIds đã suy ra ở trên, không lưu
    // trùng lặp nữa.
    setSelected(new Set(result.selected));
  }

  if (students.length === 0) {
    return (
      <p className="rounded-md border border-border bg-background/40 px-4 py-5 text-sm text-muted-foreground">
        Hãy thêm học viên vào lớp trước khi giao bài.
      </p>
    );
  }

  const padY = compact ? "py-2" : "py-3";

  // Chỉ lọc theo tên ở chế độ rộng (modal giao bài); form sửa bài giữ nguyên
  // danh sách đầy đủ như cũ.
  const visibleStudentIds = wide
    ? new Set(
        students
          .filter((student) => matchesSearch(`${student.displayName} ${student.email}`, query))
          .map((student) => student.id)
      )
    : null;

  return (
    <div ref={rootRef} className="space-y-3">
      {/* Các id đã chọn vẫn được gửi qua các input ẩn (checkbox controlled bên dưới) */}
      {wide ? (
        <div className="space-y-2">
          {classOptions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {classOptions.map((classItem) => (
                <button
                  key={classItem.id}
                  type="button"
                  onClick={() => handleClassChipClick(classItem.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    activeClassIds.includes(classItem.id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:border-primary"
                  }`}
                >
                  {classItem.name}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm học viên…"
              className="min-w-[12rem] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
            />
            <button
              type="button"
              onClick={toggleAll}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition hover:border-primary"
            >
              {allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
            </button>
            <span className="text-xs text-muted-foreground">
              Đã chọn {selected.size}/{students.length}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {classOptions.length > 0 ? (
            <select
              defaultValue=""
              onChange={(event) => {
                selectClass(event.target.value);
                event.currentTarget.value = "";
              }}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
            >
              <option value="">+ Tích nhanh theo lớp…</option>
              {classOptions.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            onClick={toggleAll}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition hover:border-primary"
          >
            {allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
          </button>
          <span className="text-xs text-muted-foreground">
            Đã chọn {selected.size}/{students.length}
          </span>
        </div>
      )}

      <div
        className={
          wide
            ? "grid rounded-md border border-border bg-background/40 sm:grid-cols-2"
            : "divide-y divide-border rounded-md border border-border bg-background/40"
        }
      >
        {students.map((student) => {
          // Học viên bị lọc CHỈ được ẩn bằng class, không được gỡ khỏi DOM —
          // nếu gỡ, học viên đã tick mà bị lọc đi sẽ mất khỏi FormData khi Giao bài.
          const hiddenBySearch = visibleStudentIds !== null && !visibleStudentIds.has(student.id);
          return (
            <label
              key={student.id}
              className={`flex gap-3 px-4 text-sm ${padY} ${
                wide ? "border-b border-border" : ""
              } ${hiddenBySearch ? "hidden" : ""}`}
            >
              <input
                name="studentIds"
                value={student.id}
                type="checkbox"
                checked={selected.has(student.id)}
                onChange={() => toggle(student.id)}
                className="mt-1 h-4 w-4 rounded border-border accent-primary"
              />
              <span>
                <span className="block font-medium">{student.displayName}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {student.email}
                  {student.classNames.length > 0 ? ` | ${student.classNames.join(", ")}` : ""}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
