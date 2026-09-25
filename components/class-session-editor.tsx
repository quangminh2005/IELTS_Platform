"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ActionDeleteButton, ActionForm, ActionSubmitButton } from "@/components/action-form";
import { addClassSession, deleteClassSession, updateClassSession } from "@/lib/actions/class-schedule";
import { vnDateKey } from "@/lib/attendance";
import { formatVnTime } from "@/lib/class-schedule";

export type EditableSession = {
  id: string;
  startsAt: string; // ISO
  endsAt: string;
  status: string;
  mode: string;
  kind: string;
  meetingUrl: string | null;
  note: string | null;
  originalStartsAt: string | null;
};

const MODE_OPTIONS: Array<[string, string]> = [
  ["offline", "Trực tiếp"],
  ["online", "Online"]
];
const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2";

// Modal sửa một buổi (session != null) hoặc thêm buổi mới (session == null).
// Portal ra body: overlay fixed nằm trong phần tử có animate-fade-in sẽ bị kẹt.
export function ClassSessionEditor({
  classId,
  session,
  todayKey,
  onClose
}: {
  classId: string;
  session: EditableSession | null;
  todayKey: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState(session?.mode ?? "offline");

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) {
    return null;
  }

  const startsAt = session ? new Date(session.startsAt) : null;
  const endsAt = session ? new Date(session.endsAt) : null;
  const closeOnOk = (result: { ok: boolean }) => {
    if (result.ok) {
      onClose();
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={session ? "Sửa buổi học" : "Thêm buổi học"}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <ActionForm
        action={session ? updateClassSession : addClassSession}
        onResult={closeOnOk}
        className="max-h-[90vh] w-full space-y-4 overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-card sm:max-w-md sm:rounded-2xl"
      >
        <h4 className="text-base font-semibold">{session ? "Sửa buổi học" : "Thêm buổi học"}</h4>

        {session ? (
          <>
            <input type="hidden" name="sessionId" value={session.id} />
            <fieldset className="flex flex-wrap gap-4 text-sm">
              <legend className="sr-only">Trạng thái</legend>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="status"
                  value="scheduled"
                  defaultChecked={session.status !== "cancelled"}
                  className="accent-primary"
                />
                Có học
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="status"
                  value="cancelled"
                  defaultChecked={session.status === "cancelled"}
                  className="accent-primary"
                />
                Nghỉ
              </label>
            </fieldset>
          </>
        ) : (
          <>
            <input type="hidden" name="classId" value={classId} />
            <fieldset className="flex flex-wrap gap-4 text-sm">
              <legend className="sr-only">Loại buổi</legend>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="kind" value="makeup" defaultChecked className="accent-primary" />
                Học bù <span className="text-xs text-muted-foreground">(tính vào số buổi)</span>
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="kind" value="extra" className="accent-primary" />
                Tăng cường <span className="text-xs text-muted-foreground">(không tính)</span>
              </label>
            </fieldset>
          </>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <label className="col-span-2 block text-sm font-medium sm:col-span-1">
            Ngày
            <input
              type="date"
              name="date"
              required
              defaultValue={startsAt ? vnDateKey(startsAt) : todayKey}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-medium">
            Bắt đầu
            <input
              type="time"
              name="start"
              required
              defaultValue={startsAt ? formatVnTime(startsAt) : "20:00"}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-medium">
            Kết thúc
            <input
              type="time"
              name="end"
              required
              defaultValue={endsAt ? formatVnTime(endsAt) : "21:30"}
              className={fieldClass}
            />
          </label>
        </div>

        <fieldset className="text-sm">
          <legend className="font-medium">Hình thức</legend>
          <div className="mt-1 flex gap-4">
            {MODE_OPTIONS.map(([value, label]) => (
              <label key={value} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="accent-primary"
                />
                {label}
              </label>
            ))}
          </div>
          {mode === "online" ? (
            <input
              type="url"
              name="meetingUrl"
              aria-label="Link phòng học"
              required
              placeholder="https://meet.google.com/…"
              defaultValue={session?.meetingUrl ?? ""}
              className={fieldClass}
            />
          ) : null}
        </fieldset>

        <label className="block text-sm font-medium">
          Ghi chú{" "}
          <span className="font-normal text-muted-foreground">(học gì, cần chuẩn bị gì, lý do nghỉ…)</span>
          <textarea
            name="note"
            rows={3}
            maxLength={500}
            defaultValue={session?.note ?? ""}
            className={fieldClass}
          />
        </label>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {session && session.kind !== "regular" ? (
            <ActionDeleteButton
              action={deleteClassSession}
              onResult={closeOnOk}
              confirmMessage="Xoá buổi này? Học viên sẽ không còn thấy buổi này trên lịch."
              className="mr-auto rounded-lg border border-border px-3 py-2 text-sm font-semibold text-red-600 transition hover:border-red-400 dark:text-red-400"
            >
              Xoá buổi
            </ActionDeleteButton>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted"
          >
            Huỷ
          </button>
          <ActionSubmitButton className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90">
            {session ? "Lưu" : "Thêm buổi"}
          </ActionSubmitButton>
        </div>
      </ActionForm>
    </div>,
    document.body
  );
}
