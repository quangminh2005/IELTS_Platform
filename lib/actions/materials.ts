"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { requireTeacher } from "@/lib/actions/classes";
import { normalizeAnswer } from "@/lib/grading";
import { materialNoticePath } from "@/lib/material-notices";
import { prisma } from "@/lib/prisma";
import { syncTranscriptTiming } from "@/lib/transcript-sync";

const skills = ["listening", "reading", "writing", "speaking"] as const;
const unitTypes = ["listening_part", "reading_passage", "writing_task", "speaking_part"] as const;
const questionTypes = [
  "multiple_choice",
  "short_answer",
  "matching",
  "drag_drop_matching",
  "gap_fill",
  "inline_gap_fill",
  "table_completion",
  "note_completion",
  "true_false_not_given",
  "writing_task",
  "speaking_task"
] as const;

const materialSchema = z.object({
  title: z.string().trim().min(2, "Tiêu đề tài liệu cần ít nhất 2 ký tự."),
  skill: z.enum(skills, "Chọn một kỹ năng IELTS hợp lệ."),
  sourceLabel: z.string().trim().optional(),
  description: z.string().trim().optional()
});

const unitSchema = z
  .object({
    materialId: z.string().trim().min(1, "Chọn tài liệu."),
    unitType: z.enum(unitTypes, "Chọn loại phần hợp lệ."),
    unitNumber: z.coerce.number().int().min(1, "Số thứ tự phải từ 1 trở lên."),
    title: z.string().trim().min(2, "Tiêu đề phần cần ít nhất 2 ký tự."),
    instructions: z.string().trim().optional(),
    // Reading/Writing cần Nội dung (bài đọc/đề bài); Listening/Speaking lấy
    // nguồn từ audio nên có thể để trống — kiểm tra ở superRefine bên dưới.
    content: z.string().trim().optional(),
    audioUrl: z.string().trim().optional(),
    transcript: z.string().trim().optional(),
    defaultTimeLimitMinutes: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      z.coerce.number().int().min(1, "Thời gian phải từ 1 phút trở lên.").optional()
    ),
    metadataJson: z.string().trim().optional(),
    imageUrlsJson: z.string().trim().optional()
  })
  .superRefine((data, ctx) => {
    const needsContent =
      data.unitType === "reading_passage" || data.unitType === "writing_task";
    if (needsContent && !data.content) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "Phần đọc/viết cần có Nội dung."
      });
    }
  });

const questionSchema = z.object({
  assignableUnitId: z.string().trim().min(1, "Chọn phần cho câu hỏi."),
  order: z.coerce.number().int().min(1, "Thứ tự phải từ 1 trở lên."),
  questionType: z.string().trim().min(1, "Thiếu dạng câu."),
  prompt: z.string().trim().min(1, "Đề bài không được để trống."),
  optionsJson: z.string().trim().optional(),
  correctAnswerJson: z.string().trim().optional(),
  explanation: z.string().trim().optional(),
  answerEvidence: z.string().trim().optional(),
  points: z.coerce.number().int().min(1, "Điểm phải từ 1 trở lên.")
});

const idSchema = z.string().trim().min(1);

function optionalText(value?: string) {
  return value ? value : null;
}

// Chạy đồng bộ mốc thời gian audio<->transcript cho phần nghe (nếu đủ điều kiện)
// và trả chuỗi ghi chú nối vào thông báo lưu. KHÔNG ném lỗi — đồng bộ hỏng thì
// việc lưu vẫn thành công, chỉ nhắn nhẹ để giáo viên biết.
async function syncTimingNote(unit: {
  id: string;
  skill: string;
  audioUrl: string | null;
  transcript: string | null;
}): Promise<string> {
  if (unit.skill !== "listening" || !unit.audioUrl || !unit.transcript) {
    return "";
  }
  try {
    const result = await syncTranscriptTiming(unit.id);
    if (result.ok) {
      return ` Đã đồng bộ mốc audio (khớp ${Math.round(result.matchRatio * 100)}%).`;
    }
    return ` Chưa đồng bộ được mốc audio: ${result.error}`;
  } catch (error) {
    console.warn("Đồng bộ mốc audio thất bại:", (error as Error).message);
    return " Chưa đồng bộ được mốc audio (lỗi hệ thống).";
  }
}

function optionalJson(value: string | undefined, label: string) {
  if (!value) {
    return null;
  }

  try {
    return JSON.stringify(JSON.parse(value));
  } catch {
    throw new Error(`${label} phải là JSON hợp lệ.`);
  }
}

// Gộp danh sách ảnh (từ ImageUpload) vào metadata JSON của phần. Ảnh lưu ở
// metadata.images = [url, ...] nên không cần thêm cột DB (tránh migration).
function buildUnitMetadata(
  metadataJson: string | undefined,
  imageUrlsJson: string | undefined
): string | null {
  let meta: Record<string, unknown> = {};

  if (metadataJson) {
    try {
      const parsed = JSON.parse(metadataJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        meta = parsed as Record<string, unknown>;
      }
    } catch {
      throw new Error("Metadata phải là JSON hợp lệ.");
    }
  }

  if (imageUrlsJson !== undefined) {
    let images: string[] = [];
    try {
      const parsed = JSON.parse(imageUrlsJson);
      if (Array.isArray(parsed)) {
        images = parsed.map((url) => String(url)).filter((url) => url.trim().length > 0);
      }
    } catch {
      // Bỏ qua: coi như không có ảnh.
    }

    if (images.length > 0) {
      meta.images = images;
    } else {
      delete meta.images;
    }
  }

  return Object.keys(meta).length > 0 ? JSON.stringify(meta) : null;
}

export async function createMaterial(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const parsed = materialSchema.safeParse({
      title: formData.get("title"),
      skill: formData.get("skill"),
      sourceLabel: formData.get("sourceLabel"),
      description: formData.get("description")
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Thông tin tài liệu chưa hợp lệ.");
    }

    await prisma.material.create({
      data: {
        teacherId: teacher.id,
        skill: parsed.data.skill,
        title: parsed.data.title,
        sourceLabel: optionalText(parsed.data.sourceLabel),
        description: optionalText(parsed.data.description)
      }
    });

    revalidatePath("/teacher");
    revalidatePath("/teacher/materials");
    return actionOk(`Đã tạo tài liệu "${parsed.data.title}".`);
  } catch (error) {
    return actionFail(error, "Tạo tài liệu");
  }
}

export async function updateMaterial(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const id = idSchema.parse(formData.get("materialId"));
    const parsed = materialSchema.safeParse({
      title: formData.get("title"),
      skill: formData.get("skill"),
      sourceLabel: formData.get("sourceLabel"),
      description: formData.get("description")
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Thông tin tài liệu chưa hợp lệ.");
    }

    const result = await prisma.material.updateMany({
      where: {
        id,
        teacherId: teacher.id
      },
      data: {
        skill: parsed.data.skill,
        title: parsed.data.title,
        sourceLabel: optionalText(parsed.data.sourceLabel),
        description: optionalText(parsed.data.description)
      }
    });

    if (result.count === 0) {
      throw new Error("Không tìm thấy tài liệu này.");
    }

    await prisma.assignableUnit.updateMany({
      where: {
        materialId: id
      },
      data: {
        skill: parsed.data.skill
      }
    });

    revalidatePath("/teacher");
    revalidatePath("/teacher/materials");
    return actionOk(`Đã lưu tài liệu "${parsed.data.title}".`);
  } catch (error) {
    return actionFail(error, "Lưu tài liệu");
  }
}

export async function deleteMaterial(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const id = idSchema.parse(formData.get("materialId"));

    const material = await prisma.material.findFirst({
      where: {
        id,
        teacherId: teacher.id
      },
      select: {
        id: true,
        units: {
          select: {
            _count: {
              select: {
                assignmentUnits: true,
                answers: true,
                highlights: true
              }
            }
          }
        }
      }
    });

    if (!material) {
      throw new Error("Không tìm thấy tài liệu này.");
    }

    // Cho phép xoá kể cả khi đã giao bài / có bài làm. Xoá tài liệu sẽ kéo theo
    // (cascade ở DB) các phần, câu hỏi, câu trả lời và đánh dấu liên quan; các
    // bài tập đã giao có thể còn lại nhưng mất phần dùng tài liệu này.
    const answerCount = material.units.reduce((sum, unit) => sum + unit._count.answers, 0);
    const assignedCount = material.units.reduce(
      (sum, unit) => sum + unit._count.assignmentUnits,
      0
    );

    await prisma.material.delete({
      where: { id: material.id }
    });

    revalidatePath("/teacher");
    revalidatePath("/teacher/materials");

    return actionOk(
      answerCount > 0 || assignedCount > 0
        ? `Đã xoá tài liệu (kèm ${answerCount} câu trả lời của học sinh${
            assignedCount > 0 ? `, gỡ khỏi ${assignedCount} lượt giao bài` : ""
          }).`
        : "Đã xoá tài liệu."
    );
  } catch (error) {
    return actionFail(error, "Xoá tài liệu");
  }
}

export async function createUnit(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const parsed = unitSchema.safeParse({
      materialId: formData.get("materialId"),
      unitType: formData.get("unitType"),
      unitNumber: formData.get("unitNumber"),
      title: formData.get("title"),
      instructions: formData.get("instructions"),
      content: formData.get("content"),
      audioUrl: formData.get("audioUrl"),
      transcript: formData.get("transcript"),
      defaultTimeLimitMinutes: formData.get("defaultTimeLimitMinutes"),
      metadataJson: formData.get("metadataJson"),
      imageUrlsJson: formData.get("imageUrlsJson")
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Thông tin phần chưa hợp lệ.");
    }

    const material = await prisma.material.findFirst({
      where: {
        id: parsed.data.materialId,
        teacherId: teacher.id
      },
      select: {
        id: true,
        skill: true
      }
    });

    if (!material) {
      throw new Error("Không tìm thấy tài liệu của giáo viên này.");
    }

    const created = await prisma.assignableUnit.create({
      data: {
        materialId: material.id,
        skill: material.skill,
        unitType: parsed.data.unitType,
        unitNumber: parsed.data.unitNumber,
        title: parsed.data.title,
        instructions: optionalText(parsed.data.instructions),
        content: parsed.data.content ?? "",
        audioUrl: optionalText(parsed.data.audioUrl),
        transcript: optionalText(parsed.data.transcript),
        defaultTimeLimitMinutes: parsed.data.defaultTimeLimitMinutes ?? null,
        metadataJson: buildUnitMetadata(parsed.data.metadataJson, parsed.data.imageUrlsJson)
      },
      select: { id: true, skill: true, audioUrl: true, transcript: true }
    });

    // Phần nghe có đủ audio + transcript -> đồng bộ mốc thời gian để trang kết quả
    // bấm transcript là tua audio. Lỗi đồng bộ không làm hỏng việc tạo phần.
    const syncNote = await syncTimingNote(created);

    revalidatePath("/teacher/materials");
    return actionOk(`Đã tạo phần "${parsed.data.title}".${syncNote}`);
  } catch (error) {
    return actionFail(error, "Tạo phần");
  }
}

export async function updateUnit(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const id = idSchema.parse(formData.get("unitId"));
    const parsed = unitSchema.safeParse({
      materialId: formData.get("materialId"),
      unitType: formData.get("unitType"),
      unitNumber: formData.get("unitNumber"),
      title: formData.get("title"),
      instructions: formData.get("instructions"),
      content: formData.get("content"),
      audioUrl: formData.get("audioUrl"),
      transcript: formData.get("transcript"),
      defaultTimeLimitMinutes: formData.get("defaultTimeLimitMinutes"),
      metadataJson: formData.get("metadataJson"),
      imageUrlsJson: formData.get("imageUrlsJson")
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Thông tin phần chưa hợp lệ.");
    }

    const material = await prisma.material.findFirst({
      where: {
        id: parsed.data.materialId,
        teacherId: teacher.id
      },
      select: {
        id: true,
        skill: true
      }
    });

    if (!material) {
      throw new Error("Không tìm thấy tài liệu của giáo viên này.");
    }

    // Đọc audio/transcript cũ để biết có cần đồng bộ lại mốc thời gian không.
    const existing = await prisma.assignableUnit.findFirst({
      where: { id, material: { teacherId: teacher.id } },
      select: { audioUrl: true, transcript: true, transcriptTimingJson: true }
    });

    const newAudioUrl = optionalText(parsed.data.audioUrl);
    const newTranscript = optionalText(parsed.data.transcript);
    const timingInputsChanged =
      !existing ||
      existing.audioUrl !== newAudioUrl ||
      existing.transcript !== newTranscript;

    const result = await prisma.assignableUnit.updateMany({
      where: {
        id,
        material: {
          teacherId: teacher.id
        }
      },
      data: {
        materialId: material.id,
        skill: material.skill,
        unitType: parsed.data.unitType,
        unitNumber: parsed.data.unitNumber,
        title: parsed.data.title,
        instructions: optionalText(parsed.data.instructions),
        content: parsed.data.content ?? "",
        audioUrl: newAudioUrl,
        transcript: newTranscript,
        defaultTimeLimitMinutes: parsed.data.defaultTimeLimitMinutes ?? null,
        metadataJson: buildUnitMetadata(parsed.data.metadataJson, parsed.data.imageUrlsJson),
        // Audio/transcript đổi -> mốc cũ không còn đúng, xóa để đồng bộ lại bên dưới.
        ...(timingInputsChanged ? { transcriptTimingJson: null } : {})
      }
    });

    if (result.count === 0) {
      throw new Error("Không tìm thấy phần này.");
    }

    const syncNote =
      timingInputsChanged || !existing?.transcriptTimingJson
        ? await syncTimingNote({
            id,
            skill: material.skill,
            audioUrl: newAudioUrl,
            transcript: newTranscript
          })
        : "";

    revalidatePath("/teacher/materials");
    return actionOk(`Đã lưu phần "${parsed.data.title}".${syncNote}`);
  } catch (error) {
    return actionFail(error, "Lưu phần");
  }
}

export async function deleteUnit(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const id = idSchema.parse(formData.get("unitId"));

    const unit = await prisma.assignableUnit.findFirst({
      where: {
        id,
        material: {
          teacherId: teacher.id
        }
      },
      select: {
        id: true,
        title: true,
        _count: {
          select: {
            assignmentUnits: true,
            answers: true,
            highlights: true
          }
        }
      }
    });

    if (!unit) {
      throw new Error("Không tìm thấy phần này.");
    }

    if (unit._count.assignmentUnits > 0 || unit._count.answers > 0 || unit._count.highlights > 0) {
      throw new Error("Phần này đã được giao hoặc đã có bài làm nên không xoá được.");
    }

    await prisma.assignableUnit.delete({
      where: { id: unit.id }
    });

    revalidatePath("/teacher/materials");
    return actionOk(`Đã xoá phần "${unit.title}".`);
  } catch (error) {
    return actionFail(error, "Xoá phần");
  }
}

export async function createQuestion(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ
  const order = String(formData.get("order") ?? "?");

  try {
    const parsed = questionSchema.safeParse({
      assignableUnitId: formData.get("assignableUnitId"),
      order: formData.get("order"),
      questionType: formData.get("questionType"),
      prompt: formData.get("prompt"),
      optionsJson: formData.get("optionsJson"),
      correctAnswerJson: formData.get("correctAnswerJson"),
      explanation: formData.get("explanation"),
      answerEvidence: formData.get("answerEvidence"),
      points: formData.get("points")
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Thông tin câu hỏi chưa hợp lệ.");
    }

    const unit = await prisma.assignableUnit.findFirst({
      where: {
        id: parsed.data.assignableUnitId,
        material: {
          teacherId: teacher.id
        }
      },
      select: {
        id: true
      }
    });

    if (!unit) {
      throw new Error("Không tìm thấy phần này của giáo viên.");
    }

    await prisma.question.create({
      data: {
        assignableUnitId: unit.id,
        order: parsed.data.order,
        questionType: parsed.data.questionType,
        prompt: parsed.data.prompt,
        optionsJson: optionalJson(parsed.data.optionsJson, "Lựa chọn"),
        correctAnswerJson: optionalJson(parsed.data.correctAnswerJson, "Đáp án"),
        explanation: optionalText(parsed.data.explanation),
        answerEvidence: optionalText(parsed.data.answerEvidence),
        points: parsed.data.points
      }
    });

    revalidatePath("/teacher/materials");
    return actionOk(`Đã tạo câu ${parsed.data.order}.`);
  } catch (error) {
    return actionFail(error, `Tạo câu ${order}`);
  }
}

export async function updateQuestion(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ
  const order = String(formData.get("order") ?? "?");

  try {
    const id = idSchema.parse(formData.get("questionId"));
    const parsed = questionSchema.safeParse({
      assignableUnitId: formData.get("assignableUnitId"),
      order: formData.get("order"),
      questionType: formData.get("questionType"),
      prompt: formData.get("prompt"),
      optionsJson: formData.get("optionsJson"),
      correctAnswerJson: formData.get("correctAnswerJson"),
      explanation: formData.get("explanation"),
      answerEvidence: formData.get("answerEvidence"),
      points: formData.get("points")
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Thông tin câu hỏi chưa hợp lệ.");
    }

    const unit = await prisma.assignableUnit.findFirst({
      where: {
        id: parsed.data.assignableUnitId,
        material: {
          teacherId: teacher.id
        }
      },
      select: {
        id: true
      }
    });

    if (!unit) {
      throw new Error("Không tìm thấy phần này của giáo viên.");
    }

    const result = await prisma.question.updateMany({
      where: {
        id,
        assignableUnit: {
          material: {
            teacherId: teacher.id
          }
        }
      },
      data: {
        assignableUnitId: unit.id,
        order: parsed.data.order,
        questionType: parsed.data.questionType,
        prompt: parsed.data.prompt,
        optionsJson: optionalJson(parsed.data.optionsJson, "Lựa chọn"),
        correctAnswerJson: optionalJson(parsed.data.correctAnswerJson, "Đáp án"),
        explanation: optionalText(parsed.data.explanation),
        answerEvidence: optionalText(parsed.data.answerEvidence),
        points: parsed.data.points
      }
    });

    if (result.count === 0) {
      throw new Error("Không tìm thấy câu hỏi này.");
    }

    revalidatePath("/teacher/materials");
    return actionOk(`Đã lưu câu ${parsed.data.order}.`);
  } catch (error) {
    return actionFail(error, `Lưu câu ${order}`);
  }
}

export async function deleteQuestion(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const id = idSchema.parse(formData.get("questionId"));

    const question = await prisma.question.findFirst({
      where: {
        id,
        assignableUnit: {
          material: {
            teacherId: teacher.id
          }
        }
      },
      select: {
        id: true,
        order: true
      }
    });

    if (!question) {
      throw new Error("Không tìm thấy câu hỏi này.");
    }

    await prisma.question.delete({
      where: { id: question.id }
    });

    revalidatePath("/teacher/materials");
    return actionOk(`Đã xoá câu ${question.order}.`);
  } catch (error) {
    return actionFail(error, "Xoá câu hỏi");
  }
}

const importScalar = z.union([z.string(), z.number(), z.boolean()]);

const importQuestionSchema = z.object({
  order: z.number().int().min(1),
  questionType: z.enum(questionTypes),
  // Cho phép prompt rỗng: dạng "Choose TWO letters" tách 1 câu hỏi thành 2 câu con,
  // đề thật nằm ở metadata.groupInstructions nên câu con không có phần dẫn riêng.
  prompt: z.string().trim(),
  options: z.array(importScalar).optional(),
  answer: z.union([importScalar, z.array(importScalar)]).optional(),
  explanation: z.string().trim().optional(),
  evidence: z.string().trim().optional(),
  points: z.number().int().min(1).default(1)
});

const importUnitSchema = z.object({
  unitType: z.enum(unitTypes),
  unitNumber: z.number().int().min(1),
  title: z.string().trim().min(2),
  instructions: z.string().trim().optional(),
  content: z.string().min(1),
  audioUrl: z.string().trim().optional(),
  transcript: z.string().trim().optional(),
  defaultTimeLimitMinutes: z.number().int().min(1).optional(),
  metadata: z.unknown().optional(),
  questions: z.array(importQuestionSchema).default([])
});

const importMaterialSchema = z.object({
  title: z.string().trim().min(2),
  skill: z.enum(skills),
  sourceLabel: z.string().trim().optional(),
  description: z.string().trim().optional(),
  units: z.array(importUnitSchema).min(1, "Need at least one unit.")
});

type ImportMaterial = z.infer<typeof importMaterialSchema>;

function placeholderNumbers(content: string) {
  const numbers = new Set<number>();
  const pattern = /\[\[(\d+)\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    numbers.add(Number(match[1]));
  }

  return numbers;
}

function answersAsArray(answer: ImportMaterial["units"][number]["questions"][number]["answer"]) {
  if (answer === undefined) {
    return [];
  }

  return (Array.isArray(answer) ? answer : [answer]).map((value) => String(value));
}

// Types whose stored answer must equal one of the option labels.
const optionRequiredTypes = new Set([
  "multiple_choice",
  "matching",
  "drag_drop_matching",
  "inline_gap_fill"
]);

// Types that place [[n]] blanks inside the unit content.
const contentBlankTypes = new Set(["table_completion", "note_completion"]);

function validateImport(data: ImportMaterial) {
  const errors: string[] = [];

  data.units.forEach((unit) => {
    const where = `Phần "${unit.title}" (unit ${unit.unitNumber})`;
    const orders = unit.questions.map((question) => question.order);
    const duplicates = [...new Set(orders.filter((order, index) => orders.indexOf(order) !== index))];

    if (duplicates.length > 0) {
      errors.push(`${where}: trùng Order ${duplicates.join(", ")}.`);
    }

    // Blank [[n]] có thể nằm trong Content HOẶC trong thân tách riêng
    // (metadata.noteBody / tableBody) — gộp tất cả để kiểm tra.
    const meta =
      unit.metadata && typeof unit.metadata === "object" && !Array.isArray(unit.metadata)
        ? (unit.metadata as Record<string, unknown>)
        : {};
    const blankSources = [unit.content, meta.noteBody, meta.tableBody]
      .filter((value): value is string => typeof value === "string")
      .join("\n");
    const blanks = placeholderNumbers(blankSources);

    unit.questions
      .filter((question) => contentBlankTypes.has(question.questionType))
      .forEach((question) => {
        if (!blanks.has(question.order)) {
          errors.push(
            `${where} - câu ${question.order}: dạng điền chỗ trống nhưng Content thiếu [[${question.order}]].`
          );
        }
      });

    blanks.forEach((number) => {
      if (!orders.includes(number)) {
        errors.push(`${where}: Content có [[${number}]] nhưng không có câu hỏi Order ${number}.`);
      }
    });

    unit.questions.forEach((question) => {
      const qWhere = `${where} - câu ${question.order}`;
      const options = (question.options ?? []).map((option) => String(option));
      const answers = answersAsArray(question.answer);

      if (optionRequiredTypes.has(question.questionType) && options.length === 0) {
        errors.push(`${qWhere}: dạng "${question.questionType}" cần "options".`);
      }

      const noAnswerNeeded =
        question.questionType === "writing_task" || question.questionType === "speaking_task";
      if (answers.length === 0 && !noAnswerNeeded) {
        errors.push(`${qWhere}: thiếu "answer".`);
      }

      if (options.length > 0 && answers.length > 0) {
        const normalizedOptions = options.map(normalizeAnswer);

        answers.forEach((answer) => {
          if (!normalizedOptions.includes(normalizeAnswer(answer))) {
            errors.push(`${qWhere}: đáp án "${answer}" không nằm trong "options".`);
          }
        });
      }
    });
  });

  return errors;
}

// Trạng thái trả về cho useFormState ở khối Nhập JSON. Khi lỗi: KHÔNG chuyển
// trang (ở lại trang nhập, giữ nguyên nội dung), chỉ trả thông báo để hiện tại chỗ.
export type ImportMaterialState = {
  status: "idle" | "error";
  message: string;
};

function importError(message: string): ImportMaterialState {
  return { status: "error", message };
}

export async function importMaterial(
  _prevState: ImportMaterialState,
  formData: FormData
): Promise<ImportMaterialState> {
  const teacher = await requireTeacher();
  const raw = String(formData.get("payload") ?? "").trim();

  if (!raw) {
    return importError("Dán nội dung JSON trước khi import.");
  }

  let payload: unknown = null;
  let jsonError = false;

  try {
    payload = JSON.parse(raw);
  } catch {
    jsonError = true;
  }

  if (jsonError) {
    return importError("JSON không hợp lệ — kiểm tra lại cú pháp.");
  }

  const parsed = importMaterialSchema.safeParse(payload);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".");
    return importError(
      `Sai cấu trúc${path ? ` tại "${path}"` : ""}: ${issue?.message ?? "dữ liệu không hợp lệ."}`
    );
  }

  const data = parsed.data;
  const semanticErrors = validateImport(data);

  if (semanticErrors.length > 0) {
    return importError(semanticErrors[0]);
  }

  const questionCount = data.units.reduce((sum, unit) => sum + unit.questions.length, 0);

  const createdMaterial = await prisma.material.create({
    data: {
      teacherId: teacher.id,
      skill: data.skill,
      title: data.title,
      sourceLabel: optionalText(data.sourceLabel),
      description: optionalText(data.description),
      units: {
        create: data.units.map((unit) => ({
          skill: data.skill,
          unitType: unit.unitType,
          unitNumber: unit.unitNumber,
          title: unit.title,
          instructions: optionalText(unit.instructions),
          content: unit.content,
          audioUrl: optionalText(unit.audioUrl),
          transcript: optionalText(unit.transcript),
          defaultTimeLimitMinutes: unit.defaultTimeLimitMinutes ?? null,
          metadataJson:
            unit.metadata === undefined || unit.metadata === null
              ? null
              : JSON.stringify(unit.metadata),
          questions: {
            create: unit.questions.map((question) => ({
              order: question.order,
              questionType: question.questionType,
              prompt: question.prompt,
              optionsJson:
                question.options && question.options.length > 0
                  ? JSON.stringify(question.options.map((option) => String(option)))
                  : null,
              correctAnswerJson:
                question.answer === undefined ? null : JSON.stringify(question.answer),
              explanation: optionalText(question.explanation),
              answerEvidence: optionalText(question.evidence),
              points: question.points
            }))
          }
        }))
      }
    }
  });

  // Đồng bộ mốc thời gian audio<->transcript cho các phần nghe vừa import (để
  // trang kết quả bấm transcript là tua audio). Chạy song song; phần nào lỗi thì
  // bỏ qua — import vẫn thành công, backfill/lưu lại phần đó sẽ đồng bộ sau.
  const listeningUnits = await prisma.assignableUnit.findMany({
    where: {
      materialId: createdMaterial.id,
      skill: "listening",
      audioUrl: { not: null },
      transcript: { not: null }
    },
    select: { id: true }
  });
  let syncedCount = 0;
  if (listeningUnits.length > 0) {
    const results = await Promise.all(
      listeningUnits.map((unit) =>
        syncTranscriptTiming(unit.id).catch((error) => {
          console.warn("Đồng bộ mốc audio thất bại:", (error as Error).message);
          return { ok: false as const, error: "lỗi hệ thống" };
        })
      )
    );
    syncedCount = results.filter((result) => result.ok).length;
  }
  const syncNote =
    listeningUnits.length > 0
      ? ` Đồng bộ mốc audio: ${syncedCount}/${listeningUnits.length} phần nghe.`
      : "";

  revalidatePath("/teacher");
  revalidatePath("/teacher/materials");
  redirect(
    materialNoticePath(
      "success",
      `Đã import "${data.title}": ${data.units.length} phần, ${questionCount} câu hỏi.${syncNote}`
    )
  );
}

const practiceOpenSchema = z.object({
  materialId: z.string().trim().min(1, "Thiếu tài liệu."),
  practiceOpen: z.enum(["0", "1"], "Giá trị không hợp lệ.")
});

// Bật/tắt việc đưa một đề vào thư viện tự luyện. Mở là mở cho MỌI học viên.
// Tắt chỉ khiến đề biến khỏi thư viện — lượt đã làm và kết quả giữ nguyên.
export async function setPracticeOpen(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();
  const parsed = practiceOpenSchema.safeParse({
    materialId: formData.get("materialId"),
    practiceOpen: formData.get("practiceOpen")
  });

  if (!parsed.success) {
    return actionFail(
      new Error(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ."),
      "Cập nhật tự luyện"
    );
  }

  const material = await prisma.material.findFirst({
    where: { id: parsed.data.materialId, teacherId: teacher.id },
    select: { id: true, title: true }
  });

  if (!material) {
    return actionFail(new Error("Không tìm thấy tài liệu."), "Cập nhật tự luyện");
  }

  const practiceOpen = parsed.data.practiceOpen === "1";

  await prisma.material.update({
    where: { id: material.id },
    data: { practiceOpen }
  });

  revalidatePath("/teacher/materials");

  return actionOk(
    practiceOpen
      ? `Đã mở "${material.title}" cho học viên tự luyện.`
      : `Đã gỡ "${material.title}" khỏi thư viện tự luyện.`
  );
}

const practiceLockAudioSchema = z.object({
  materialId: z.string().trim().min(1, "Thiếu tài liệu."),
  practiceLockAudio: z.enum(["0", "1"], "Giá trị không hợp lệ.")
});

// Bật/tắt "ẩn thanh audio" cho riêng luồng TỰ LUYỆN của một đề Listening. Bài giao
// thường không đọc cờ này — bài giao có ô "Ẩn thanh audio" riêng (Assignment.lockAudio).
// Đổi cờ chỉ ảnh hưởng các lượt tự luyện MỞ SAU đó; lượt đang làm dở giữ nguyên chế
// độ của lúc bắt đầu để không đổi luật giữa chừng (xem lib/actions/practice.ts).
export async function setPracticeLockAudio(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();
  const parsed = practiceLockAudioSchema.safeParse({
    materialId: formData.get("materialId"),
    practiceLockAudio: formData.get("practiceLockAudio")
  });

  if (!parsed.success) {
    return actionFail(
      new Error(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ."),
      "Cập nhật thanh audio tự luyện"
    );
  }

  const material = await prisma.material.findFirst({
    where: { id: parsed.data.materialId, teacherId: teacher.id },
    select: { id: true, title: true }
  });

  if (!material) {
    return actionFail(
      new Error("Không tìm thấy tài liệu."),
      "Cập nhật thanh audio tự luyện"
    );
  }

  const practiceLockAudio = parsed.data.practiceLockAudio === "1";

  await prisma.material.update({
    where: { id: material.id },
    data: { practiceLockAudio }
  });

  revalidatePath("/teacher/materials");

  return actionOk(
    practiceLockAudio
      ? `Tự luyện "${material.title}" sẽ ẩn thanh audio như thi thật.`
      : `Tự luyện "${material.title}" sẽ hiện thanh audio (nghe/tua tự do).`
  );
}
