"use client";

import { useState } from "react";
import { ActionForm, ActionSubmitButton } from "@/components/action-form";
import { deleteStudentVocabWord, updateStudentVocabWord } from "@/lib/actions/vocab-deck";

// Sửa / xoá từ học viên TỰ GÕ nghĩa trong Sổ từ. Xoá phải bấm hai lần (không dùng
// window.confirm — hộp thoại gốc làm đơ trình duyệt tự động khi kiểm thử).
export function VocabWordEdit({
  cardId,
  meaningVi,
  exampleEn
}: {
  cardId: string;
  meaningVi: string;
  exampleEn: string;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (editing) {
    return (
      <ActionForm
        action={updateStudentVocabWord}
        className="mt-2 space-y-2 rounded-lg border border-border bg-background/60 p-3"
        onResult={(result) => {
          if (result.ok) {
            setEditing(false);
          }
        }}
      >
        <input type="hidden" name="cardId" value={cardId} />
        <label className="block text-xs font-medium text-muted-foreground">
          Nghĩa tiếng Việt
          <input
            name="meaningVi"
            defaultValue={meaningVi}
            required
            maxLength={200}
            className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Câu ví dụ
          <textarea
            name="exampleEn"
            defaultValue={exampleEn}
            rows={2}
            maxLength={500}
            className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          />
        </label>
        <div className="flex gap-2">
          <ActionSubmitButton className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            Lưu
          </ActionSubmitButton>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
          >
            Huỷ
          </button>
        </div>
      </ActionForm>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="font-semibold text-primary hover:underline"
      >
        Sửa nghĩa
      </button>
      {confirmDelete ? (
        <ActionForm action={deleteStudentVocabWord} className="flex items-center gap-2">
          <input type="hidden" name="cardId" value={cardId} />
          <span className="text-muted-foreground">Xoá từ này khỏi Sổ từ?</span>
          <ActionSubmitButton
            pendingLabel="Đang xoá…"
            className="font-semibold text-destructive hover:underline"
          >
            Xoá hẳn
          </ActionSubmitButton>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="font-semibold text-muted-foreground hover:underline"
          >
            Thôi
          </button>
        </ActionForm>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="font-semibold text-muted-foreground hover:text-destructive hover:underline"
        >
          Xoá
        </button>
      )}
    </div>
  );
}
