"use client";

import { useMemo, useState } from "react";

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
};

export function StudentPicker({
  students,
  classOptions,
  selectedStudentIds,
  compact = false
}: StudentPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(selectedStudentIds ?? [])
  );

  const allSelected = students.length > 0 && selected.size === students.length;

  const studentsByClass = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const student of students) {
      for (const classId of student.classIds) {
        const list = map.get(classId) ?? [];
        list.push(student.id);
        map.set(classId, list);
      }
    }
    return map;
  }, [students]);

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
    setSelected((current) =>
      current.size === students.length ? new Set() : new Set(students.map((s) => s.id))
    );
  }

  function selectClass(classId: string) {
    if (!classId) {
      return;
    }
    const ids = studentsByClass.get(classId) ?? [];
    setSelected((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }

  if (students.length === 0) {
    return (
      <p className="rounded-md border border-border bg-background/40 px-4 py-5 text-sm text-muted-foreground">
        Hãy thêm học viên vào lớp trước khi giao bài.
      </p>
    );
  }

  const padY = compact ? "py-2" : "py-3";

  return (
    <div className="space-y-3">
      {/* Các id đã chọn vẫn được gửi qua các input ẩn (checkbox controlled bên dưới) */}
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
        <span className="text-xs text-muted-foreground">Đã chọn {selected.size}/{students.length}</span>
      </div>

      <div className="divide-y divide-border rounded-md border border-border bg-background/40">
        {students.map((student) => (
          <label key={student.id} className={`flex gap-3 px-4 text-sm ${padY}`}>
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
        ))}
      </div>
    </div>
  );
}
