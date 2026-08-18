"use client";

import { useState } from "react";
import { ActionForm, ActionSubmitButton } from "@/components/action-form";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import {
  regenerateParentToken,
  saveParentContact,
  sendParentReportNow
} from "@/lib/actions/parents";

type ParentContactBlockProps = {
  studentId: string;
  parentName: string;
  parentEmail: string;
  // Link đầy đủ để copy. Null khi chưa có email phụ huynh.
  parentLink: string | null;
  lastSentAt: Date | null;
};

const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary";

function formatSentAt(value: Date | null): string {
  if (!value) {
    return "Chưa gửi lần nào";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "numeric",
    year: "numeric"
  }).format(value);
}

export function ParentContactBlock({
  studentId,
  parentName,
  parentEmail,
  parentLink,
  lastSentAt
}: ParentContactBlockProps) {
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
        <h3 className="text-base font-semibold">Phụ huynh</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Có email thì mỗi trưa Chủ nhật hệ thống tự gửi báo cáo tình hình học tập. Để
          trống email là không gửi gì cả.
        </p>
      </div>

      <div className="space-y-4 px-5 py-4">
        <ActionForm action={saveParentContact} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="studentId" value={studentId} />
          <label className="text-sm font-medium">
            Tên phụ huynh
            <input
              name="parentName"
              defaultValue={parentName}
              placeholder="VD: chị Lan"
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-medium">
            Email phụ huynh
            <input
              name="parentEmail"
              type="email"
              defaultValue={parentEmail}
              placeholder="phuhuynh@gmail.com"
              className={fieldClass}
            />
          </label>
          <div className="sm:col-span-2">
            <ActionSubmitButton className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90">
              Lưu
            </ActionSubmitButton>
          </div>
        </ActionForm>

        {parentLink ? (
          <div className="space-y-3 rounded-lg border border-border bg-background px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Link phụ huynh xem báo cáo
              </p>
              <p className="mt-1 break-all font-mono text-xs">{parentLink}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold transition hover:border-primary"
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
            </div>
            <ActionForm
              action={sendParentReportNow}
              className="flex flex-wrap items-center gap-2 border-t border-border pt-3"
            >
              <input type="hidden" name="studentId" value={studentId} />
              <select
                name="period"
                defaultValue="week"
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              >
                <option value="week">7 ngày qua</option>
                <option value="month">30 ngày qua</option>
              </select>
              <ActionSubmitButton
                pendingLabel="Đang gửi…"
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                Gửi báo cáo ngay
              </ActionSubmitButton>
            </ActionForm>

            <p className="text-xs text-muted-foreground">
              Mail gần nhất: {formatSentAt(lastSentAt)}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
