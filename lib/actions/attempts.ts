"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { requireTeacher } from "@/lib/actions/classes";
import { auth } from "@/lib/auth";
import { gradeAttempt } from "@/lib/grading";
import { gradeUnits } from "@/lib/attempt-grading";
import { allSkillsSubmitted, orderedSkillsOfAssignment, unitsForSkill } from "@/lib/skill-sessions";
import { sanitizePartTimesJson } from "@/lib/skill-times";
import { parseSkillTimeLimits } from "@/lib/skill-parse";
import { isSkillTimeUp, skillBudgetSeconds } from "@/lib/active-time";
import { mergeCount } from "@/lib/proctor-signals";
import { prisma } from "@/lib/prisma";

const highlightSchema = z.object({
  attemptId: z.string().trim().min(1),
  assignableUnitId: z.string().trim().min(1),
  sourceType: z.string().trim().min(1),
  selectedText: z.string().trim().min(1),
  startOffset: z.coerce.number().int().min(0),
  endOffset: z.coerce.number().int().min(0),
  color: z.string().trim().min(1).default("yellow"),
  note: z.string().trim().optional()
});

export async function requireStudent() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id || user.role !== "student") {
    throw new Error("Student access required.");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: user.id }
  });

  if (!student) {
    throw new Error("Student profile required.");
  }

  return student;
}

function optionalText(value?: string) {
  return value ? value : null;
}

export async function startAttempt(recipientId: string) {
  const student = await requireStudent();
  const recipient = await prisma.assignmentRecipient.findFirst({
    where: {
      id: recipientId,
      studentId: student.id
    },
    select: {
      id: true,
      status: true
    }
  });

  if (!recipient) {
    throw new Error("Assignment not found for this student.");
  }

  // Mỗi bài chỉ làm MỘT lần: nếu đã có lần làm nào (đang làm hoặc đã nộp) thì
  // trả về lần đó — KHÔNG tạo lần làm mới. Lần đang làm thì tiếp tục; lần đã nộp
  // thì trang sẽ tự chuyển sang xem kết quả (không cho làm lại).
  const latestAttempt = await prisma.attempt.findFirst({
    where: {
      assignmentRecipientId: recipient.id,
      studentId: student.id
    },
    orderBy: { startedAt: "desc" }
  });

  if (latestAttempt) {
    if (latestAttempt.status === "in_progress" && recipient.status !== "in_progress") {
      await prisma.assignmentRecipient.update({
        where: { id: recipient.id },
        data: { status: "in_progress" }
      });
    }

    return latestAttempt;
  }

  return prisma.$transaction(async (tx) => {
    const attempt = await tx.attempt.create({
      data: {
        assignmentRecipientId: recipient.id,
        studentId: student.id,
        status: "in_progress"
      }
    });

    await tx.assignmentRecipient.update({
      where: { id: recipient.id },
      data: { status: "in_progress" }
    });

    return attempt;
  });
}

// Tạo các dòng AttemptSkill còn thiếu cho mọi kỹ năng của bài. Idempotent — gọi
// mỗi lần mở phòng làm bài để bài cũ (tạo trước tính năng) cũng có bản ghi kỹ năng.
export async function ensureAttemptSkills(attemptId: string): Promise<void> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: {
      status: true,
      skills: { select: { skill: true } },
      assignmentRecipient: {
        select: {
          assignment: {
            select: { units: { select: { assignableUnit: { select: { skill: true } } } } }
          }
        }
      }
    }
  });
  if (!attempt) return;

  const skills = orderedSkillsOfAssignment(attempt.assignmentRecipient.assignment.units);
  const existing = new Set(attempt.skills.map((s) => s.skill));
  const missing = skills.filter((s) => !existing.has(s));
  if (missing.length === 0) return;

  await prisma.attemptSkill.createMany({
    data: missing.map((skill) => ({
      attemptId,
      skill,
      status: attempt.status === "submitted" ? "submitted" : "not_started"
    })),
    skipDuplicates: true
  });
}

const skillSessionSchema = z.object({
  attemptId: z.string().trim().min(1),
  skill: z.enum(["listening", "reading", "writing", "speaking"])
});

// Học sinh mở một kỹ năng trong phòng làm bài: đánh dấu "đang làm" + lưu thời
// điểm bắt đầu (chỉ lần đầu). Bỏ qua nếu kỹ năng đã bị khoá (đã nộp).
export async function startSkillSession(formData: FormData) {
  const student = await requireStudent();
  const parsed = skillSessionSchema.safeParse({
    attemptId: formData.get("attemptId"),
    skill: formData.get("skill")
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Kỹ năng không hợp lệ.");
  }

  const attempt = await prisma.attempt.findFirst({
    where: { id: parsed.data.attemptId, studentId: student.id, status: "in_progress" },
    select: { id: true }
  });
  if (!attempt) {
    throw new Error("Không tìm thấy lần làm bài đang mở.");
  }

  await ensureAttemptSkills(attempt.id);

  const skillRow = await prisma.attemptSkill.findUnique({
    where: { attemptId_skill: { attemptId: attempt.id, skill: parsed.data.skill } }
  });
  if (!skillRow || skillRow.status === "submitted") {
    return; // đã khoá hoặc không thuộc bài — không làm gì.
  }

  if (skillRow.status === "not_started") {
    await prisma.attemptSkill.update({
      where: { id: skillRow.id },
      data: { status: "in_progress", startedAt: new Date() }
    });
  }
}

const submitSkillSchema = z.object({
  attemptId: z.string().trim().min(1),
  skill: z.enum(["listening", "reading", "writing", "speaking"]),
  submitReason: z.enum(["manual", "auto_timeout"]).default("manual"),
  elapsedSeconds: z.coerce.number().int().min(0).default(0),
  tabSwitchCount: z.coerce.number().int().min(0).default(0),
  findAttemptCount: z.coerce.number().int().min(0).default(0)
});

// Học sinh nộp riêng một kỹ năng: chấm + ghi Answer của các unit thuộc kỹ năng
// đó, khoá AttemptSkill. Nếu đây là kỹ năng cuối cùng còn lại thì finalize luôn
// cả Attempt (tính điểm tổng từ Answer đã lưu, không lệ thuộc formData của lần
// nộp này vì formData chỉ chứa dữ liệu kỹ năng vừa nộp).
export async function submitSkill(formData: FormData) {
  const student = await requireStudent();
  const parsed = submitSkillSchema.safeParse({
    attemptId: formData.get("attemptId"),
    skill: formData.get("skill"),
    submitReason: formData.get("submitReason") ?? "manual",
    elapsedSeconds: formData.get("elapsedSeconds") ?? 0,
    tabSwitchCount: formData.get("tabSwitchCount") ?? 0,
    findAttemptCount: formData.get("findAttemptCount") ?? 0
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dữ liệu nộp không hợp lệ.");
  }
  const attempt = await prisma.attempt.findFirst({
    where: { id: parsed.data.attemptId, studentId: student.id },
    include: {
      skills: true,
      assignmentRecipient: {
        include: {
          assignment: {
            include: {
              units: {
                orderBy: { order: "asc" },
                include: {
                  assignableUnit: {
                    include: { questions: { orderBy: { order: "asc" } } }
                  }
                }
              }
            }
          }
        }
      }
    }
  });
  if (!attempt) {
    throw new Error("Không tìm thấy lần làm bài.");
  }

  await ensureAttemptSkills(attempt.id);

  const skillRow =
    attempt.skills.find((s) => s.skill === parsed.data.skill) ??
    (await prisma.attemptSkill.findUnique({
      where: { attemptId_skill: { attemptId: attempt.id, skill: parsed.data.skill } }
    }));
  if (skillRow?.status === "submitted") {
    redirect(`/student/results/${attempt.id}?skill=${parsed.data.skill}`);
  }

  // Tự động nộp khi hết giờ: chỉ chấp nhận khi kỹ năng THẬT SỰ đã dùng hết ngân
  // sách thời gian (chống nộp non do client lỗi). Speaking không bao giờ tự nộp.
  if (parsed.data.submitReason === "auto_timeout") {
    if (parsed.data.skill === "speaking") {
      return;
    }
    const assignment = attempt.assignmentRecipient.assignment;
    const isMultiSkill = orderedSkillsOfAssignment(assignment.units).length > 1;
    const budget = skillBudgetSeconds(
      parsed.data.skill,
      parseSkillTimeLimits(assignment.skillTimeLimitsJson),
      isMultiSkill,
      assignment.timeLimitMinutes
    );
    if (budget == null) {
      return; // kỹ năng không giới hạn giờ → không tự nộp.
    }
    const elapsed = Math.max(parsed.data.elapsedSeconds, skillRow?.elapsedSeconds ?? 0);
    if (!isSkillTimeUp(elapsed, budget)) {
      return; // client gửi nhầm lúc chưa hết giờ.
    }
  }

  const allUnits = attempt.assignmentRecipient.assignment.units;
  const skillUnits = unitsForSkill(allUnits, parsed.data.skill);
  const skillUnitIds = skillUnits.map((u) => u.assignableUnitId);

  const graded = gradeUnits(
    skillUnits.map((au) => ({
      assignableUnitId: au.assignableUnitId,
      skill: au.assignableUnit.skill,
      content: au.assignableUnit.content,
      transcript: au.assignableUnit.transcript,
      questions: au.assignableUnit.questions
    })),
    (questionId) => String(formData.get(`q_${questionId}`) ?? "")
  );
  const answerRows = graded.answerRows.map((row) => ({
    ...row,
    attemptId: attempt.id,
    studentId: student.id
  }));
  const skillGrade = gradeAttempt(graded.gradeItems);
  // Kỹ năng chấm tay (Viết/Nói) không có câu tự chấm nào — gradeAttempt([]) sẽ
  // trả score/scorePercent = 0, gây hiểu nhầm là "0%". Lưu null để trang kết quả
  // hiển thị "chờ chấm" thay vì điểm giả.
  const manualSkill = parsed.data.skill === "writing" || parsed.data.skill === "speaking";

  const submittedAt = new Date();
  // Đánh dấu khi đây là lần nộp làm hoàn tất cả Attempt (kỹ năng cuối cùng), để
  // sau transaction biết redirect kèm ?submitted=1 (bật hiệu ứng chúc mừng) thay
  // vì ?skill=... (chỉ xem kết quả một kỹ năng).
  let finalized = false;

  await prisma.$transaction(async (tx) => {
    // Chỉ xoá đáp án của các unit thuộc kỹ năng này — không đụng kỹ năng khác.
    await tx.answer.deleteMany({
      where: { attemptId: attempt.id, assignableUnitId: { in: skillUnitIds } }
    });
    if (answerRows.length > 0) {
      await tx.answer.createMany({ data: answerRows });
    }
    await tx.attemptSkill.update({
      where: { attemptId_skill: { attemptId: attempt.id, skill: parsed.data.skill } },
      data: {
        status: "submitted",
        submittedAt,
        elapsedSeconds: parsed.data.elapsedSeconds,
        score: manualSkill ? null : skillGrade.score,
        scorePercent: manualSkill ? null : skillGrade.scorePercent
      }
    });

    // Ghi nhận hành vi đáng ngờ: gắn với cả Attempt (không tách theo kỹ năng). Chạy ở
    // MỌI lượt nộp chứ không chỉ lượt cuối, vì heartbeat gần nhất có thể đã cũ tới 10
    // giây. mergeCount đảm bảo chỉ tăng, không kéo lùi số đã lưu.
    await tx.attempt.update({
      where: { id: attempt.id },
      data: {
        tabSwitchCount: mergeCount(attempt.tabSwitchCount, parsed.data.tabSwitchCount),
        findAttemptCount: mergeCount(attempt.findAttemptCount, parsed.data.findAttemptCount)
      }
    });

    // Kiểm tra đã nộp hết chưa (đọc lại trong transaction cho chắc).
    const skills = await tx.attemptSkill.findMany({ where: { attemptId: attempt.id } });
    if (allSkillsSubmitted(skills)) {
      // Điểm tổng lấy từ toàn bộ Answer đã lưu (mọi kỹ năng đã nộp) — không dùng
      // formData vì formData chỉ có dữ liệu của kỹ năng vừa nộp. Join Question để
      // lấy đúng số điểm mỗi câu (không giả định points = 1).
      const savedAnswers = await tx.answer.findMany({
        where: { attemptId: attempt.id },
        select: { pointsAwarded: true, isCorrect: true, question: { select: { points: true } } }
      });
      // Chỉ tính các câu tự chấm (Nghe/Đọc); Viết/Nói isCorrect = null → bỏ.
      const autoGraded = savedAnswers.filter((a) => a.isCorrect !== null);
      const totalScore = autoGraded.reduce((sum, a) => sum + (a.pointsAwarded ?? 0), 0);
      const maxScore = autoGraded.reduce((sum, a) => sum + (a.question?.points ?? 1), 0);
      const scorePercent = maxScore === 0 ? 0 : Math.round((totalScore / maxScore) * 100);

      await tx.attempt.update({
        where: { id: attempt.id },
        data: {
          status: "submitted",
          submittedAt,
          submitReason: "manual",
          // Tổng thời gian làm bài = tổng elapsedSeconds của từng kỹ năng (skills
          // đã đọc lại ở trên nên đã có giá trị mới nhất của kỹ năng vừa nộp).
          elapsedSeconds: skills.reduce((sum, row) => sum + (row.elapsedSeconds ?? 0), 0),
          score: totalScore,
          scorePercent,
          autoGradedAt: submittedAt
        }
      });
      await tx.assignmentRecipient.update({
        where: { id: attempt.assignmentRecipientId },
        data: { status: "submitted", submittedAt }
      });
      finalized = true;
    }
  });

  revalidatePath("/student");
  revalidatePath("/student/history");
  revalidatePath(`/student/assignments/${attempt.assignmentRecipientId}`);
  // Chỉ bật hiệu ứng chúc mừng (?submitted=1) khi đây là kỹ năng cuối cùng làm
  // Attempt hoàn tất; nộp một kỹ năng giữa chừng thì chỉ xem kết quả kỹ năng đó.
  redirect(
    finalized
      ? `/student/results/${attempt.id}?submitted=1`
      : `/student/results/${attempt.id}?skill=${parsed.data.skill}`
  );
}

export async function saveAttemptDraft(formData: FormData) {
  const student = await requireStudent();
  const attemptId = String(formData.get("attemptId") ?? "").trim();

  if (!attemptId) {
    throw new Error("Attempt id is required.");
  }

  const attempt = await prisma.attempt.findFirst({
    where: {
      id: attemptId,
      studentId: student.id,
      status: "in_progress"
    },
    include: {
      assignmentRecipient: {
        include: {
          assignment: {
            include: {
              units: {
                include: {
                  assignableUnit: {
                    select: { skill: true, questions: { select: { id: true } } }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!attempt) {
    throw new Error("Attempt not found for this student.");
  }

  const submittedSkillRows = await prisma.attemptSkill.findMany({
    where: { attemptId: attempt.id, status: "submitted" },
    select: { skill: true }
  });
  const submittedSkills = new Set(submittedSkillRows.map((row) => row.skill));

  const units = attempt.assignmentRecipient.assignment.units;
  // Unit thuộc kỹ năng ĐÃ NỘP: đáp án đã chấm — tuyệt đối không xoá/ghi đè khi lưu nháp.
  const lockedUnitIds = units
    .filter((assignmentUnit) => submittedSkills.has(assignmentUnit.assignableUnit.skill))
    .map((assignmentUnit) => assignmentUnit.assignableUnitId);

  const draftRows = units
    .filter((assignmentUnit) => !submittedSkills.has(assignmentUnit.assignableUnit.skill))
    .flatMap((assignmentUnit) =>
      assignmentUnit.assignableUnit.questions.map((question) => ({
        attemptId: attempt.id,
        studentId: student.id,
        questionId: question.id,
        assignableUnitId: assignmentUnit.assignableUnitId,
        value: String(formData.get(`q_${question.id}`) ?? "").trim()
      }))
    )
    .filter((row) => row.value !== "");

  // Lưu kèm thời gian theo phần (nếu client gửi) để đóng/mở lại bài không bị mất.
  // Chỉ cập nhật khi form thực sự có trường này — tránh ghi đè null mất dữ liệu cũ.
  const rawPartTimes = formData.get("partTimesJson");
  const partTimesUpdate =
    rawPartTimes !== null
      ? [
          prisma.attempt.update({
            where: { id: attempt.id },
            data: { partTimesJson: sanitizePartTimesJson(String(rawPartTimes)) }
          })
        ]
      : [];

  // Heartbeat thời gian làm thực: ghi vào AttemptSkill.elapsedSeconds của kỹ năng
  // đang mở. Chỉ tăng (max) để nhịp lỗi/nhiều tab không kéo lùi; bỏ qua kỹ năng đã nộp.
  const draftSkill = String(formData.get("skill") ?? "").trim();
  const draftElapsed = Number(formData.get("elapsedSeconds"));
  const skillRowForElapsed =
    draftSkill && Number.isFinite(draftElapsed) && draftElapsed >= 0
      ? await prisma.attemptSkill.findUnique({
          where: { attemptId_skill: { attemptId: attempt.id, skill: draftSkill } },
          select: { elapsedSeconds: true, status: true }
        })
      : null;
  const skillElapsedUpdate =
    skillRowForElapsed && skillRowForElapsed.status !== "submitted"
      ? [
          prisma.attemptSkill.updateMany({
            where: { attemptId: attempt.id, skill: draftSkill, status: { not: "submitted" } },
            data: {
              elapsedSeconds: Math.max(
                skillRowForElapsed.elapsedSeconds,
                Math.floor(draftElapsed)
              )
            }
          })
        ]
      : [];

  // Ghi nhận hành vi đáng ngờ theo nhịp heartbeat. `attempt` query bằng include: nên
  // đã có sẵn hai cột này. mergeCount chặn việc nhịp đến trễ kéo lùi số đã lưu.
  const proctorUpdate = [
    prisma.attempt.update({
      where: { id: attempt.id },
      data: {
        tabSwitchCount: mergeCount(
          attempt.tabSwitchCount,
          Number(formData.get("tabSwitchCount"))
        ),
        findAttemptCount: mergeCount(
          attempt.findAttemptCount,
          Number(formData.get("findAttemptCount"))
        )
      }
    })
  ];

  await prisma.$transaction([
    prisma.answer.deleteMany({
      where: {
        attemptId: attempt.id,
        ...(lockedUnitIds.length > 0 ? { assignableUnitId: { notIn: lockedUnitIds } } : {})
      }
    }),
    ...(draftRows.length > 0
      ? [prisma.answer.createMany({ data: draftRows })]
      : []),
    ...partTimesUpdate,
    ...skillElapsedUpdate,
    ...proctorUpdate
  ]);
}

export async function saveHighlight(formData: FormData) {
  const student = await requireStudent();
  const parsed = highlightSchema.safeParse({
    attemptId: formData.get("attemptId"),
    assignableUnitId: formData.get("assignableUnitId"),
    sourceType: formData.get("sourceType"),
    selectedText: formData.get("selectedText"),
    startOffset: formData.get("startOffset"),
    endOffset: formData.get("endOffset"),
    color: formData.get("color") ?? "yellow",
    note: formData.get("note")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid highlight details.");
  }

  const attempt = await prisma.attempt.findFirst({
    where: {
      id: parsed.data.attemptId,
      studentId: student.id,
      status: "in_progress"
    },
    include: {
      assignmentRecipient: {
        select: { assignmentId: true }
      }
    }
  });

  if (!attempt) {
    throw new Error("Attempt not found for this student.");
  }

  const assignmentUnit = await prisma.assignmentUnit.findFirst({
    where: {
      assignmentId: attempt.assignmentRecipient.assignmentId,
      assignableUnitId: parsed.data.assignableUnitId
    },
    select: { id: true }
  });

  if (!assignmentUnit) {
    throw new Error("Unit is not part of this assignment.");
  }

  if (parsed.data.endOffset < parsed.data.startOffset) {
    throw new Error("Highlight offsets are invalid.");
  }

  const created = await prisma.highlight.create({
    data: {
      attemptId: attempt.id,
      studentId: student.id,
      assignableUnitId: parsed.data.assignableUnitId,
      sourceType: parsed.data.sourceType,
      selectedText: parsed.data.selectedText,
      startOffset: parsed.data.startOffset,
      endOffset: parsed.data.endOffset,
      color: parsed.data.color,
      note: optionalText(parsed.data.note)
    },
    select: { id: true }
  });

  // Không revalidate ở đây: phòng làm bài quản lý highlight phía client để tô
  // màu ngay lập tức, tránh refresh server giữa lúc đang làm bài.
  return { id: created.id };
}

export async function deleteHighlight(formData: FormData) {
  const student = await requireStudent();
  const highlightId = String(formData.get("highlightId") ?? "").trim();

  if (!highlightId) {
    throw new Error("Missing highlight id.");
  }

  await prisma.highlight.deleteMany({
    where: {
      id: highlightId,
      studentId: student.id,
      attempt: { status: "in_progress" }
    }
  });
}

// Giáo viên cho học sinh làm lại một bài: xoá các lần làm của bài đó (kèm đáp án,
// highlight... theo cascade) và đặt lại trạng thái "chưa làm". Sau đó học sinh mở
// bài sẽ bắt đầu một lần làm mới.
export async function resetRecipientAttempts(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const recipientId = String(formData.get("recipientId") ?? "").trim();

    if (!recipientId) {
      throw new Error("Thiếu mã bài giao.");
    }

    // Chỉ cho phép thao tác trên bài thuộc lớp/bài tập của chính giáo viên này.
    const recipient = await prisma.assignmentRecipient.findFirst({
      where: {
        id: recipientId,
        assignment: { teacherId: teacher.id }
      },
      select: { id: true, studentId: true }
    });

    if (!recipient) {
      throw new Error("Không tìm thấy bài giao này.");
    }

    await prisma.$transaction([
      prisma.attempt.deleteMany({ where: { assignmentRecipientId: recipient.id } }),
      prisma.assignmentRecipient.update({
        where: { id: recipient.id },
        data: { status: "assigned", submittedAt: null }
      })
    ]);

    revalidatePath("/student");
    revalidatePath(`/teacher/students/${recipient.studentId}`);
    return actionOk("Đã đặt lại lượt làm cho bài này.");
  } catch (error) {
    return actionFail(error, "Đặt lại lượt làm");
  }
}
