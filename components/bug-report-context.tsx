"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

// Ngữ cảnh do màn làm bài đăng ký: bài nào, part nào, bước nào đang mở — để hộp
// thoại gửi kèm mà học viên không phải tự mô tả "em đang ở part 2".
export type BugAttemptContext = { attemptId: string; unitTitle: string; step?: number };

type BugReportContextValue = {
  // false = không có provider (vd. giáo viên xem trước đề trong AppShell teacher).
  available: boolean;
  attemptContext: BugAttemptContext | null;
  setAttemptContext: (context: BugAttemptContext | null) => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const noop = () => {};

const FALLBACK: BugReportContextValue = {
  available: false,
  attemptContext: null,
  setAttemptContext: noop,
  isOpen: false,
  open: noop,
  close: noop
};

const BugReportContext = createContext<BugReportContextValue | null>(null);

// Không ném lỗi khi thiếu provider: attempt-workspace dùng hook này nhưng cũng được
// render trong khu vực giáo viên (xem trước đề), nơi không có nút báo lỗi.
export function useBugReport(): BugReportContextValue {
  return useContext(BugReportContext) ?? FALLBACK;
}

export function BugReportProvider({ children }: { children: ReactNode }) {
  const [attemptContext, setAttemptContextState] = useState<BugAttemptContext | null>(null);
  const [isOpen, setOpen] = useState(false);

  // So sánh từng trường để màn làm bài gọi lại mỗi lần render không gây render vô ích.
  const setAttemptContext = useCallback((next: BugAttemptContext | null) => {
    setAttemptContextState((previous) => {
      if (previous === next) return previous;
      if (
        previous &&
        next &&
        previous.attemptId === next.attemptId &&
        previous.unitTitle === next.unitTitle &&
        previous.step === next.step
      ) {
        return previous;
      }
      return next;
    });
  }, []);

  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ available: true, attemptContext, setAttemptContext, isOpen, open, close }),
    [attemptContext, setAttemptContext, isOpen, open, close]
  );

  return <BugReportContext.Provider value={value}>{children}</BugReportContext.Provider>;
}
