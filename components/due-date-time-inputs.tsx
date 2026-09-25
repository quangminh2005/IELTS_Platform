"use client";

import { useState } from "react";
import { DueDateField } from "@/components/due-date-field";
import type { SessionPick } from "@/lib/class-schedule";

// Cụm "Ngày / Giờ" hạn nộp của modal giao bài. Giờ là state có kiểm soát để chip
// "Trước buổi học tới" điền được cả giờ, không chỉ ngày.
export function DueDateTimeInputs({
  fieldClass,
  sessionPicks
}: {
  fieldClass: string;
  sessionPicks: SessionPick[];
}) {
  const [time, setTime] = useState("23:59");

  return (
    <div className="mt-2 grid gap-3 sm:grid-cols-2">
      <div>
        <label className="block text-xs font-medium text-muted-foreground" htmlFor="dueDate">
          Ngày
        </label>
        <DueDateField
          id="dueDate"
          name="dueDate"
          quickPicks
          sessionPicks={sessionPicks}
          onPickTime={setTime}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground" htmlFor="dueTime">
          Giờ
        </label>
        <input
          id="dueTime"
          name="dueTime"
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          className={fieldClass}
        />
      </div>
    </div>
  );
}
