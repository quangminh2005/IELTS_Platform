"use client";

import { useState } from "react";
import { ActionForm, ActionSubmitButton } from "@/components/action-form";
import { saveClassSchedule } from "@/lib/actions/class-schedule";
import { WEEKDAY_LONG } from "@/lib/class-schedule";

export type ScheduleSlotInput = { weekday: number; start: string; end: string };
type LimitType = "sessions" | "endDate" | "none";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const LIMIT_OPTIONS: Array<[LimitType, string]> = [
  ["sessions", "Theo số buổi"],
  ["endDate", "Theo ngày kết thúc"],
  ["none", "Học liên tục"]
];
const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2";
const smallField =
  "rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2";

// Form lịch cố định hàng tuần của một lớp. Khung giờ giữ ở state rồi gửi lên dưới
// dạng JSON (slotsJson) — đỡ phải đặt tên field kiểu slots[0][weekday].
export function ClassScheduleForm({
  classId,
  initialSlots,
  startDate,
  totalSessions,
  endDate,
  location,
  hasSessions,
  todayKey
}: {
  classId: string;
  initialSlots: ScheduleSlotInput[];
  startDate: string; // YYYY-MM-DD hoặc ""
  totalSessions: number | null;
  endDate: string;
  location: string;
  hasSessions: boolean;
  todayKey: string;
}) {
  const [slots, setSlots] = useState<ScheduleSlotInput[]>(
    initialSlots.length > 0 ? initialSlots : [{ weekday: 1, start: "20:00", end: "21:30" }]
  );
  const [limitType, setLimitType] = useState<LimitType>(
    totalSessions ? "sessions" : endDate ? "endDate" : "none"
  );
  const [start, setStart] = useState(startDate || todayKey);

  function updateSlot(index: number, patch: Partial<ScheduleSlotInput>) {
    setSlots((current) => current.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  }

  return (
    <ActionForm
      action={saveClassSchedule}
      className="h-fit space-y-4 rounded-xl border border-border bg-card p-5 shadow-card"
    >
      <div>
        <h4 className="text-sm font-semibold">Lịch cố định hàng tuần</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Mỗi dòng là một buổi trong tuần. Lưu xong hệ thống tự tạo các buổi học.
        </p>
      </div>
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="slotsJson" value={JSON.stringify(slots)} />

      <div className="space-y-2">
        {slots.map((slot, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Thứ"
              value={slot.weekday}
              onChange={(event) => updateSlot(index, { weekday: Number(event.target.value) })}
              className={smallField}
            >
              {WEEKDAYS.map((day) => (
                <option key={day} value={day}>
                  {WEEKDAY_LONG[day]}
                </option>
              ))}
            </select>
            <input
              type="time"
              aria-label="Giờ bắt đầu"
              value={slot.start}
              onChange={(event) => updateSlot(index, { start: event.target.value })}
              className={smallField}
            />
            <span aria-hidden="true" className="text-muted-foreground">
              →
            </span>
            <input
              type="time"
              aria-label="Giờ kết thúc"
              value={slot.end}
              onChange={(event) => updateSlot(index, { end: event.target.value })}
              className={smallField}
            />
            <button
              type="button"
              aria-label="Xoá khung giờ"
              onClick={() => setSlots((current) => current.filter((_, i) => i !== index))}
              className="rounded-lg border border-border px-2 py-1.5 text-sm text-muted-foreground transition hover:border-red-400 hover:text-red-500"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setSlots((current) => [
              ...current,
              current.length > 0
                ? { ...current[current.length - 1] }
                : { weekday: 1, start: "20:00", end: "21:30" }
            ])
          }
          className="text-sm font-semibold text-primary hover:underline"
        >
          + Thêm khung giờ
        </button>
      </div>

      <label className="block text-sm font-medium">
        Ngày khai giảng
        <input
          type="date"
          name="startDate"
          value={start}
          onChange={(event) => setStart(event.target.value)}
          required={slots.length > 0}
          className={fieldClass}
        />
      </label>

      <fieldset>
        <legend className="text-sm font-medium">Kết thúc khoá</legend>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          {LIMIT_OPTIONS.map(([value, label]) => (
            <label key={value} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="limitType"
                value={value}
                checked={limitType === value}
                onChange={() => setLimitType(value)}
                className="accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
        {limitType === "sessions" ? (
          <input
            type="number"
            name="totalSessions"
            aria-label="Số buổi"
            min={1}
            max={500}
            defaultValue={totalSessions ?? 24}
            required
            className={fieldClass}
          />
        ) : null}
        {limitType === "endDate" ? (
          <input
            type="date"
            name="endDate"
            aria-label="Ngày kết thúc"
            defaultValue={endDate}
            min={start}
            required
            className={fieldClass}
          />
        ) : null}
      </fieldset>

      <label className="block text-sm font-medium">
        Địa điểm mặc định <span className="font-normal text-muted-foreground">(tuỳ chọn)</span>
        <input
          name="location"
          defaultValue={location}
          maxLength={200}
          placeholder="Vd: Phòng 2, 12 Lê Lợi"
          className={fieldClass}
        />
      </label>

      {hasSessions ? (
        <label className="block text-sm font-medium">
          Áp dụng từ
          <input type="date" name="applyFrom" defaultValue={todayKey} required className={fieldClass} />
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            Buổi trước ngày này và buổi đã sửa tay được giữ nguyên.
          </span>
        </label>
      ) : (
        // Lớp chưa có buổi nào: tạo cả các buổi đã qua kể từ ngày khai giảng để số
        // thứ tự buổi đúng ngay từ đầu.
        <input type="hidden" name="applyFrom" value={start} />
      )}

      <ActionSubmitButton className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90">
        Lưu lịch
      </ActionSubmitButton>
    </ActionForm>
  );
}
