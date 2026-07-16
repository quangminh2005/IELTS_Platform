"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { auth } from "@/lib/auth";
import { classNoticePath } from "@/lib/class-notices";
import { prisma } from "@/lib/prisma";

const classSchema = z.object({
  name: z.string().trim().min(2, "Tên lớp cần ít nhất 2 ký tự."),
  description: z.string().trim().optional()
});

const studentSchema = z.object({
  classId: z.string().trim().min(1, "Chọn một lớp."),
  email: z.string().trim().email("Nhập email hợp lệ.").toLowerCase(),
  displayName: z.string().trim().min(1, "Cần nhập tên học viên.")
});

const weeklyGoalSchema = z.object({
  classId: z.string().min(1),
  weeklyGoal: z.coerce.number().int().min(1).max(50)
});

export async function requireTeacher() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id || user.role !== "teacher") {
    throw new Error("Teacher access required.");
  }

  // Đọc trước (rẻ); chỉ ghi khi hồ sơ chưa tồn tại (lần đầu) để mỗi lần
  // điều hướng không phát sinh một lệnh ghi DB không cần thiết.
  const existing = await prisma.teacherProfile.findUnique({
    where: { userId: user.id }
  });

  if (existing) {
    return existing;
  }

  return prisma.teacherProfile.create({
    data: {
      userId: user.id,
      displayName: "Teacher"
    }
  });
}

export async function createClass(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const parsed = classSchema.safeParse({
      name: formData.get("name"),
      description: formData.get("description")
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Thông tin lớp chưa hợp lệ.");
    }

    await prisma.class.create({
      data: {
        teacherId: teacher.id,
        name: parsed.data.name,
        description: parsed.data.description || null
      }
    });

    revalidatePath("/teacher");
    revalidatePath("/teacher/classes");
    return actionOk(`Đã tạo lớp "${parsed.data.name}".`);
  } catch (error) {
    return actionFail(error, "Tạo lớp");
  }
}

export async function updateClassWeeklyGoal(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const parsed = weeklyGoalSchema.safeParse({
      classId: formData.get("classId"),
      weeklyGoal: formData.get("weeklyGoal")
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Chỉ tiêu tuần không hợp lệ.");
    }

    const result = await prisma.class.updateMany({
      where: { id: parsed.data.classId, teacherId: teacher.id },
      data: { weeklyGoal: parsed.data.weeklyGoal }
    });

    if (result.count === 0) {
      throw new Error("Không tìm thấy lớp này.");
    }

    revalidatePath("/teacher/classes");
    return actionOk("Đã lưu chỉ tiêu tuần.");
  } catch (error) {
    return actionFail(error, "Lưu chỉ tiêu tuần");
  }
}

export async function addStudent(formData: FormData) {
  const teacher = await requireTeacher();
  const parsed = studentSchema.safeParse({
    classId: formData.get("classId"),
    email: formData.get("email"),
    displayName: formData.get("displayName")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid student details.");
  }

  const targetClass = await prisma.class.findFirst({
    where: {
      id: parsed.data.classId,
      teacherId: teacher.id
    },
    select: { id: true }
  });

  if (!targetClass) {
    throw new Error("Class not found for this teacher.");
  }

  const student = await prisma.studentProfile.upsert({
    where: { email: parsed.data.email },
    update: {
      displayName: parsed.data.displayName
    },
    create: {
      email: parsed.data.email,
      displayName: parsed.data.displayName
    }
  });

  await prisma.classStudent.upsert({
    where: {
      classId_studentId: {
        classId: targetClass.id,
        studentId: student.id
      }
    },
    update: {},
    create: {
      classId: targetClass.id,
      studentId: student.id
    }
  });

  revalidatePath("/teacher");
  revalidatePath("/teacher/classes");
  revalidatePath(`/teacher/classes/${targetClass.id}`);
  revalidatePath(`/teacher/students/${student.id}`);
}

export async function deleteClass(formData: FormData) {
  const teacher = await requireTeacher();
  const classId = String(formData.get("classId") ?? "").trim();

  if (!classId) {
    throw new Error("Missing class id.");
  }

  // Xoá lớp: liên kết học viên–lớp (ClassStudent) tự xoá theo cascade; bài tập đã
  // giao cho lớp được giữ lại (Assignment.classId set null). Hồ sơ học viên KHÔNG bị xoá.
  const result = await prisma.class.deleteMany({
    where: { id: classId, teacherId: teacher.id }
  });

  if (result.count === 0) {
    throw new Error("Class not found for this teacher.");
  }

  revalidatePath("/teacher");
  revalidatePath("/teacher/classes");
  // "Xoá lớp" có thể bấm từ trang chi tiết lớp (trang đó sẽ không còn) → quay về danh sách.
  redirect("/teacher/classes");
}

export async function removeStudentFromClass(formData: FormData) {
  const teacher = await requireTeacher();
  const classId = String(formData.get("classId") ?? "").trim();
  const studentId = String(formData.get("studentId") ?? "").trim();

  if (!classId || !studentId) {
    throw new Error("Missing class or student id.");
  }

  // Chỉ gỡ liên kết học viên khỏi lớp; hồ sơ, bài làm, lịch sử vẫn còn.
  await prisma.classStudent.deleteMany({
    where: {
      classId,
      studentId,
      class: { teacherId: teacher.id }
    }
  });

  revalidatePath("/teacher");
  revalidatePath("/teacher/classes");
  revalidatePath(`/teacher/classes/${classId}`);
}

export async function deleteStudent(formData: FormData) {
  const teacher = await requireTeacher();
  const studentId = String(formData.get("studentId") ?? "").trim();

  if (!studentId) {
    throw new Error("Missing student id.");
  }

  // Chỉ cho phép xoá học sinh thuộc một lớp của chính giáo viên này.
  const membership = await prisma.classStudent.findFirst({
    where: { studentId, class: { teacherId: teacher.id } },
    select: { id: true }
  });

  if (!membership) {
    throw new Error("Student not found for this teacher.");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    select: { userId: true }
  });

  // Xoá hồ sơ học sinh: bài làm, đáp án, highlight, kết quả... tự xoá theo cascade.
  await prisma.studentProfile.delete({ where: { id: studentId } });

  // Xoá luôn tài khoản đăng nhập liên kết (nếu có) để học sinh không còn đăng nhập được.
  if (student?.userId) {
    await prisma.user.delete({ where: { id: student.userId } }).catch(() => undefined);
  }

  revalidatePath("/teacher");
  revalidatePath("/teacher/classes");
  redirect("/teacher/classes");
}
