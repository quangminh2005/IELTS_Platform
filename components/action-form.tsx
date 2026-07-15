"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";

export type ServerAction = (formData: FormData) => Promise<ActionResult>;

// Mạng hỏng hoặc máy chủ ném lỗi ngoài tầm kiểm soát của action. Không để Next.js
// dựng màn hình lỗi đỏ (giáo viên mất hết nội dung đang gõ) — báo bằng toast để
// bấm Lưu lại là xong.
const NETWORK_FAIL: ActionResult = {
  ok: false,
  message: "Không lưu được, kiểm tra kết nối rồi thử lại."
};

async function runAndNotify(
  action: ServerAction,
  formData: FormData,
  notify: (result: ActionResult) => void
) {
  try {
    notify(await action(formData));
  } catch {
    notify(NETWORK_FAIL);
  }
}

export function ActionForm({
  action,
  className,
  children
}: {
  action: ServerAction;
  className?: string;
  children: ReactNode;
}) {
  const { notify } = useToast();

  return (
    <form className={className} action={(formData) => runAndNotify(action, formData, notify)}>
      {children}
    </form>
  );
}

// Khoá nút trong lúc chờ để bấm hai lần không thành lưu hai lần.
export function ActionSubmitButton({
  className,
  pendingLabel = "Đang lưu…",
  children
}: {
  className?: string;
  pendingLabel?: string;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

// formAction ghi đè action của form → cùng một <form> vừa Lưu vừa Xoá được.
export function ActionDeleteButton({
  action,
  confirmMessage,
  className,
  children
}: {
  action: ServerAction;
  confirmMessage: string;
  className?: string;
  children: ReactNode;
}) {
  const { notify } = useToast();
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-60`}
      formAction={(formData) => runAndNotify(action, formData, notify)}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
