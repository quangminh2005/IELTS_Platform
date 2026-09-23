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
  studentName: string;
  // Link đầy đủ để chép. Null khi học viên chưa được tạo link.
  parentLink: string | null;
};

type CopyTarget = "link" | "message";
type CopyState = { target: CopyTarget; ok: boolean } | null;

// Tin nhắn soạn sẵn để cô dán thẳng vào Zalo, khỏi gõ lại lời dặn mỗi lần.
export function parentMessage(studentName: string, link: string): string {
  return [
    `Chào anh/chị, đây là link xem tình hình học tập của con ${studentName} ở lớp IELTS:`,
    link,
    "Anh/chị bấm vào là xem được, không cần đăng nhập. Trang tự cập nhật mỗi khi con nộp bài hoặc cô chấm bài. Anh/chị giữ link này riêng, đừng chia sẻ ra ngoài giúp cô nhé."
  ].join("\n");
}

// Chép vào bộ nhớ tạm. navigator.clipboard chỉ có trên HTTPS và có thể bị trình
// duyệt từ chối — khi đó thử cách cũ (textarea + execCommand). Trả false nếu cả
// hai đều hỏng để báo cho cô biết mà tự bôi đen chép tay.
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // rơi xuống cách cũ bên dưới
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function ParentContactBlock({ studentId, studentName, parentLink }: ParentContactBlockProps) {
  const [copyState, setCopyState] = useState<CopyState>(null);

  async function copy(target: CopyTarget) {
    if (!parentLink) {
      return;
    }

    const text = target === "link" ? parentLink : parentMessage(studentName, parentLink);
    const ok = await copyText(text);
    setCopyState({ target, ok });
    window.setTimeout(() => setCopyState(null), ok ? 2000 : 5000);
  }

  function copyLabel(target: CopyTarget, idle: string) {
    if (copyState?.target !== target) {
      return idle;
    }

    return copyState.ok ? "Đã chép" : "Không chép được";
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
            {copyState && !copyState.ok ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                Trình duyệt không cho chép tự động. Hãy bôi đen link ở trên rồi bấm Ctrl+C.
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => copy("message")}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                {copyLabel("message", "Chép tin nhắn gửi phụ huynh")}
              </button>
              <button
                type="button"
                onClick={() => copy("link")}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold transition hover:border-primary"
              >
                {copyLabel("link", "Chỉ chép link")}
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
