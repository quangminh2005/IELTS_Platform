"use client";

import Link from "next/link";
import { useState } from "react";
import { ActionForm, ActionSubmitButton } from "@/components/action-form";
import { updateClassInfo } from "@/lib/actions/classes";

type TeacherClassCardProps = {
  classItem: {
    id: string;
    name: string;
    description: string | null;
    studentCount: number;
  };
};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2";

export function TeacherClassCard({ classItem }: TeacherClassCardProps) {
  // Đổi tên ngay tại thẻ lớp: bấm "Đổi tên" thì phần đầu thẻ biến thành ô nhập,
  // lưu xong tự đóng lại (giữ nguyên nội dung đang gõ nếu lưu lỗi).
  const [editing, setEditing] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      {editing ? (
        <ActionForm
          action={updateClassInfo}
          className="space-y-3 px-5 py-4"
          onResult={(result) => {
            if (result.ok) {
              setEditing(false);
            }
          }}
        >
          <input type="hidden" name="classId" value={classItem.id} />
          <div>
            <label className="block text-sm font-medium" htmlFor={`name-${classItem.id}`}>
              Tên lớp
            </label>
            <input
              id={`name-${classItem.id}`}
              name="name"
              defaultValue={classItem.name}
              minLength={2}
              required
              autoFocus
              className={`mt-1.5 ${inputClass}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor={`description-${classItem.id}`}>
              Mô tả
            </label>
            <textarea
              id={`description-${classItem.id}`}
              name="description"
              rows={2}
              defaultValue={classItem.description ?? ""}
              className={`mt-1.5 ${inputClass}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <ActionSubmitButton className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90">
              Lưu
            </ActionSubmitButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              Huỷ
            </button>
          </div>
        </ActionForm>
      ) : (
        <Link
          href={`/teacher/classes/${classItem.id}`}
          className="block px-5 py-4 transition hover:bg-muted/40"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold">{classItem.name}</h3>
              {classItem.description ? (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {classItem.description}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="inline-flex w-fit rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                {classItem.studentCount} học viên
              </span>
              <span className="text-sm font-semibold text-primary">Mở →</span>
            </div>
          </div>
        </Link>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
        {/* Chỉ tiêu bài/tuần đã ẩn: chuỗi giờ tính theo NGÀY (Đợt 4), cột weeklyGoal giữ nguyên. */}

        {editing ? null : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="ml-auto rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            Đổi tên
          </button>
        )}
      </div>
    </div>
  );
}
