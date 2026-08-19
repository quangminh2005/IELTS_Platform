"use client";

import { useState } from "react";
import { ActionForm, ActionSubmitButton } from "@/components/action-form";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import {
  createParentLink,
  regenerateParentToken,
  removeParentLink
} from "@/lib/actions/parents";

type ParentContactBlockProps = {
  studentId: string;
  // Link đầy đủ để chép. Null khi học viên chưa được tạo link.
  parentLink: string | null;
};

export function ParentContactBlock({ studentId, parentLink }: ParentContactBlockProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!parentLink) {
      return;
    }

    await navigator.clipboard.writeText(parentLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold">Link báo cáo cho phụ huynh</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Một đường link riêng, xem được mà không cần đăng nhập. Gửi cho phụ huynh qua
          Zalo hoặc tin nhắn. Link hiện điểm từng bài, tiến bộ và nhận xét — không hiện
          đề bài hay đáp án.
        </p>
      </div>

      <div className="px-5 py-4">
        {parentLink ? (
          <div className="space-y-3">
            <p className="break-all rounded-lg border border-border bg-background px-4 py-3 font-mono text-xs">
              {parentLink}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                {copied ? "Đã chép" : "Chép link"}
              </button>
              <ActionForm action={regenerateParentToken}>
                <input type="hidden" name="studentId" value={studentId} />
                <ConfirmSubmitButton
                  confirmMessage="Tạo link mới? Link cũ sẽ ngừng hoạt động ngay, phụ huynh phải dùng link mới."
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold transition hover:border-primary"
                >
                  Tạo lại link
                </ConfirmSubmitButton>
              </ActionForm>
              <ActionForm action={removeParentLink}>
                <input type="hidden" name="studentId" value={studentId} />
                <ConfirmSubmitButton
                  confirmMessage="Thu hồi link? Phụ huynh sẽ không xem được báo cáo nữa cho tới khi bạn tạo link mới."
                  className="rounded-lg border border-red-400/60 px-3 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
                >
                  Thu hồi link
                </ConfirmSubmitButton>
              </ActionForm>
            </div>
          </div>
        ) : (
          <ActionForm action={createParentLink} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="studentId" value={studentId} />
            <ActionSubmitButton
              pendingLabel="Đang tạo…"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
            >
              Tạo link báo cáo
            </ActionSubmitButton>
            <span className="text-xs text-muted-foreground">
              Học viên này chưa có link.
            </span>
          </ActionForm>
        )}
      </div>
    </section>
  );
}
