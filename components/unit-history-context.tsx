"use client";

import { createContext, useContext } from "react";
import type { UnitHistory } from "@/lib/unit-history";

// Lịch sử "ai đã làm phần nào" + các phần đang tick trong form Tạo bài giao.
// AssignmentWizard cung cấp; UnitPickerTest (đếm HS đã làm mỗi phần) và
// StudentPicker (cảnh báo học viên trùng) đọc. Form Sửa bài giao không bọc
// provider nên hai picker giữ nguyên như cũ.
export type UnitHistoryContextValue = {
  history: UnitHistory;
  selectedUnitIds: string[];
};

export const UnitHistoryContext = createContext<UnitHistoryContextValue | null>(null);

export function useUnitHistory() {
  return useContext(UnitHistoryContext);
}
