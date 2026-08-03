"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { StudentPickerClass, StudentPickerStudent } from "@/components/student-picker";
import type { UnitPickerMaterial } from "@/components/unit-picker";

// Danh sách đề + học viên dùng chung cho MỌI form "Sửa bài giao". Đưa vào
// context để chỉ gửi xuống trình duyệt đúng MỘT lần, thay vì lặp lại theo từng
// bài đã giao (trước đây 28 bài = 28 bản cây chọn đề).
export type AssignmentEditData = {
  materials: UnitPickerMaterial[];
  students: StudentPickerStudent[];
  classOptions: StudentPickerClass[];
  // Map id phần -> kỹ năng, dùng cho ô "Thời gian mỗi kỹ năng".
  unitSkills: Record<string, string>;
};

const AssignmentEditDataContext = createContext<AssignmentEditData | null>(null);

type ProviderProps = {
  materials: UnitPickerMaterial[];
  students: StudentPickerStudent[];
  classOptions: StudentPickerClass[];
  children: ReactNode;
};

export function AssignmentEditDataProvider({
  materials,
  students,
  classOptions,
  children
}: ProviderProps) {
  const value = useMemo<AssignmentEditData>(() => {
    const unitSkills: Record<string, string> = {};
    materials.forEach((material) =>
      material.units.forEach((unit) => {
        unitSkills[unit.id] = unit.skill;
      })
    );

    return { materials, students, classOptions, unitSkills };
  }, [materials, students, classOptions]);

  return (
    <AssignmentEditDataContext.Provider value={value}>
      {children}
    </AssignmentEditDataContext.Provider>
  );
}

export function useAssignmentEditData() {
  const data = useContext(AssignmentEditDataContext);

  if (!data) {
    throw new Error("useAssignmentEditData phải nằm trong AssignmentEditDataProvider");
  }

  return data;
}
