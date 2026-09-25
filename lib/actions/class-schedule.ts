"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { requireTeacher } from "@/lib/actions/classes";
import { vnDateKey } from "@/lib/attendance";
import {
  detectChangeKind,
  isValidMeetingUrl,
  parseHm,
  parseScheduleSlots,
  scheduleSignature,
  vnDateTime,
  vnMidnight
} from "@/lib/class-schedule";
import { syncClassSessions } from "@/lib/class-schedule-sync";
import { prisma } from "@/lib/prisma";

const ymd = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ.");
const optionalYmd = z.union([ymd, z.literal("")]).optional();

const scheduleSchema = z.object({
  classId: z.string().trim().min(1, "Thiếu mã lớp."),
  slotsJson: z.string(),
  startDate: optionalYmd,
  limitType: z.enum(["sessions", "endDate", "none"]),
  totalSessions: z.string().optional(),
  endDate: optionalYmd,
  location: z.string().trim().max(200, "Địa điểm tối đa 200 ký tự.").optional(),
  applyFrom: optionalYmd
});

// Khớp chú thích enum SessionMode / SessionStatus / SessionKind trong schema.prisma.
const sessionFieldsSchema = z.object({
  date: ymd,
  start: z.string(),
  end: z.string(),
  mode: z.enum(["offline", "online"]),
  meetingUrl: z.string().trim().optional(),
  note: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự.").optional()
});
const statusSchema = z.enum(["scheduled", "cancelled"]);
const addKindSchema = z.enum(["makeup", "extra"]);

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

function parseSessionFields(formData: FormData) {
  const parsed = sessionFieldsSchema.safeParse({
    date: field(formData, "date"),
    start: field(formData, "start"),
    end: field(formData, "end"),
    mode: field(formData, "mode"),
    meetingUrl: field(formData, "meetingUrl"),
    note: field(formData, "note")
  });
  if (!parsed.success) {
    throw new Error(firstIssue(parsed.error, "Thông tin buổi học chưa hợp lệ."));
  }
  const startMinute = parseHm(parsed.data.start);
  const endMinute = parseHm(parsed.data.end);
  if (startMinute === null || endMinute === null) {
    throw new Error("Giờ học không hợp lệ.");
  }
  if (endMinute <= startMinute) {
    throw new Error("Giờ kết thúc phải sau giờ bắt đầu.");
  }
  const meetingUrl = parsed.data.meetingUrl ?? "";
  if (parsed.data.mode === "online" && !isValidMeetingUrl(meetingUrl)) {
    throw new Error("Buổi online cần link phòng học bắt đầu bằng https://");
  }
  return {
    startsAt: vnDateTime(parsed.data.date, startMinute),
    endsAt: vnDateTime(parsed.data.date, endMinute),
    mode: parsed.data.mode,
    meetingUrl: parsed.data.mode === "online" ? meetingUrl : null,
    note: parsed.data.note ? parsed.data.note : null
  };
}

function revalidateSchedule(classId: string) {
  revalidatePath(`/teacher/classes/${classId}`);
  revalidatePath("/teacher/assignments");
  revalidatePath("/student");
  revalidatePath("/student/calendar");
}

export async function saveClassSchedule(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const parsed = scheduleSchema.safeParse({
      classId: field(formData, "classId"),
      slotsJson: field(formData, "slotsJson") ?? "[]",
      startDate: field(formData, "startDate"),
      limitType: field(formData, "limitType"),
      totalSessions: field(formData, "totalSessions"),
      endDate: field(formData, "endDate"),
      location: field(formData, "location"),
      applyFrom: field(formData, "applyFrom")
    });
    if (!parsed.success) {
      throw new Error(firstIssue(parsed.error, "Lịch học chưa hợp lệ."));
    }
    const data = parsed.data;

    const classItem = await prisma.class.findFirst({
      where: { id: data.classId, teacherId: teacher.id },
      select: {
        id: true,
        name: true,
        scheduleStartDate: true,
        scheduleEndDate: true,
        totalSessions: true,
        location: true,
        scheduleSlots: { select: { weekday: true, startMinute: true, endMinute: true } }
      }
    });
    if (!classItem) {
      throw new Error("Không tìm thấy lớp.");
    }

    let rawSlots: unknown;
    try {
      rawSlots = JSON.parse(data.slotsJson);
    } catch {
      throw new Error("Lịch cố định không hợp lệ.");
    }
    const slots = parseScheduleSlots(rawSlots);

    if (slots.length > 0 && !data.startDate) {
      throw new Error("Chọn ngày khai giảng.");
    }

    let totalSessions: number | null = null;
    let endDate: Date | null = null;
    if (data.limitType === "sessions") {
      const count = Number(data.totalSessions);
      if (!Number.isInteger(count) || count < 1 || count > 500) {
        throw new Error("Số buổi phải từ 1 đến 500.");
      }
      totalSessions = count;
    }
    if (data.limitType === "endDate") {
      if (!data.endDate) {
        throw new Error("Chọn ngày kết thúc.");
      }
      if (data.startDate && data.endDate < data.startDate) {
        throw new Error("Ngày kết thúc phải sau ngày khai giảng.");
      }
      endDate = vnMidnight(data.endDate);
    }

    const startDate = data.startDate ? vnMidnight(data.startDate) : null;
    const location = data.location ? data.location : null;
    const now = new Date();
    const applyFrom = vnMidnight(data.applyFrom || data.startDate || vnDateKey(now));

    // Chỉ báo chuông "lịch vừa cập nhật" khi lịch thật sự đổi.
    const changed =
      scheduleSignature({
        slots: classItem.scheduleSlots,
        startDate: classItem.scheduleStartDate,
        totalSessions: classItem.totalSessions,
        endDate: classItem.scheduleEndDate,
        location: classItem.location
      }) !== scheduleSignature({ slots, startDate, totalSessions, endDate, location });

    await prisma.$transaction(async (tx) => {
      await tx.classScheduleSlot.deleteMany({ where: { classId: classItem.id } });
      if (slots.length > 0) {
        await tx.classScheduleSlot.createMany({
          data: slots.map((slot) => ({ classId: classItem.id, ...slot }))
        });
      }
      await tx.class.update({
        where: { id: classItem.id },
        data: {
          scheduleStartDate: startDate,
          totalSessions,
          scheduleEndDate: endDate,
          location,
          scheduleAppliesFrom: applyFrom,
          ...(changed ? { scheduleChangedAt: now } : {})
        }
      });
      await syncClassSessions(tx, classItem.id, now, applyFrom);
    });

    revalidateSchedule(classItem.id);
    return actionOk(`Đã lưu lịch học lớp "${classItem.name}".`);
  } catch (error) {
    return actionFail(error, "Lưu lịch học");
  }
}

export async function updateClassSession(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();

  try {
    const status = statusSchema.safeParse(field(formData, "status"));
    if (!status.success) {
      throw new Error("Chọn có học hay nghỉ.");
    }

    const existing = await prisma.classSession.findFirst({
      where: { id: field(formData, "sessionId") ?? "", class: { teacherId: teacher.id } },
      select: {
        id: true,
        classId: true,
        startsAt: true,
        endsAt: true,
        status: true,
        mode: true,
        originalStartsAt: true
      }
    });
    if (!existing) {
      throw new Error("Không tìm thấy buổi học.");
    }

    const fields = parseSessionFields(formData);
    const now = new Date();
    const changeKind = detectChangeKind(
      existing,
      { status: status.data, mode: fields.mode, startsAt: fields.startsAt, endsAt: fields.endsAt },
      now
    );
    const moved = fields.startsAt.getTime() !== existing.startsAt.getTime();

    await prisma.$transaction(async (tx) => {
      await tx.classSession.update({
        where: { id: existing.id },
        data: {
          status: status.data,
          mode: fields.mode,
          meetingUrl: fields.meetingUrl,
          note: fields.note,
          startsAt: fields.startsAt,
          endsAt: fields.endsAt,
          edited: true,
          // Giữ giờ GỐC qua nhiều lần dời để khung đó không bị tạo lại.
          originalStartsAt: moved
            ? existing.originalStartsAt ?? existing.startsAt
            : existing.originalStartsAt,
          ...(changeKind ? { changeKind, changedAt: now } : {})
        }
      });
      // Nghỉ / học lại làm đổi số buổi được đếm -> cuối khoá phải co giãn theo.
      if (status.data !== existing.status) {
        await syncClassSessions(tx, existing.classId, now);
      }
    });

    revalidateSchedule(existing.classId);
    return actionOk(status.data === "cancelled" ? "Đã cho nghỉ buổi học." : "Đã lưu buổi học.");
  } catch (error) {
    return actionFail(error, "Lưu buổi học");
  }
}

export async function addClassSession(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();

  try {
    const kind = addKindSchema.safeParse(field(formData, "kind"));
    if (!kind.success) {
      throw new Error("Chọn loại buổi: học bù hoặc tăng cường.");
    }

    const classItem = await prisma.class.findFirst({
      where: { id: field(formData, "classId") ?? "", teacherId: teacher.id },
      select: { id: true }
    });
    if (!classItem) {
      throw new Error("Không tìm thấy lớp.");
    }

    const fields = parseSessionFields(formData);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.classSession.create({
        data: {
          classId: classItem.id,
          kind: kind.data,
          status: "scheduled",
          mode: fields.mode,
          meetingUrl: fields.meetingUrl,
          note: fields.note,
          startsAt: fields.startsAt,
          endsAt: fields.endsAt,
          edited: true,
          ...(fields.startsAt.getTime() > now.getTime() ? { changeKind: "added", changedAt: now } : {})
        }
      });
      // Học bù được đếm vào số buổi -> buổi cuối khoá tự rút đi.
      if (kind.data === "makeup") {
        await syncClassSessions(tx, classItem.id, now);
      }
    });

    revalidateSchedule(classItem.id);
    return actionOk(kind.data === "makeup" ? "Đã thêm buổi học bù." : "Đã thêm buổi tăng cường.");
  } catch (error) {
    return actionFail(error, "Thêm buổi học");
  }
}

export async function deleteClassSession(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();

  try {
    const existing = await prisma.classSession.findFirst({
      where: { id: field(formData, "sessionId") ?? "", class: { teacherId: teacher.id } },
      select: { id: true, classId: true, kind: true }
    });
    if (!existing) {
      throw new Error("Không tìm thấy buổi học.");
    }
    if (existing.kind === "regular") {
      throw new Error("Buổi theo lịch cố định chỉ cho nghỉ, không xoá được.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.classSession.delete({ where: { id: existing.id } });
      if (existing.kind === "makeup") {
        await syncClassSessions(tx, existing.classId, new Date());
      }
    });

    revalidateSchedule(existing.classId);
    return actionOk("Đã xoá buổi học.");
  } catch (error) {
    return actionFail(error, "Xoá buổi học");
  }
}
