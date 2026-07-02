"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTeacher } from "@/lib/actions/classes";
import { normalizeAnswer } from "@/lib/grading";
import { materialNoticePath } from "@/lib/material-notices";
import { prisma } from "@/lib/prisma";

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
  "writing_task"
] as const;

const materialSchema = z.object({
  title: z.string().trim().min(2, "Material title must be at least 2 characters."),
  skill: z.enum(skills, "Choose a valid IELTS skill."),
  sourceLabel: z.string().trim().optional(),
  description: z.string().trim().optional()
});

const unitSchema = z.object({
  materialId: z.string().trim().min(1, "Choose a material."),
  unitType: z.enum(unitTypes, "Choose a valid unit type."),
  unitNumber: z.coerce.number().int().min(1, "Unit number must be at least 1."),
  title: z.string().trim().min(2, "Unit title must be at least 2 characters."),
  instructions: z.string().trim().optional(),
  content: z.string().trim().min(1, "Unit content is required."),
  audioUrl: z.string().trim().optional(),
  transcript: z.string().trim().optional(),
  defaultTimeLimitMinutes: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.number().int().min(1, "Time limit must be at least 1 minute.").optional()
  ),
  metadataJson: z.string().trim().optional(),
  imageUrlsJson: z.string().trim().optional()
});

const questionSchema = z.object({
  assignableUnitId: z.string().trim().min(1, "Choose a unit."),
  order: z.coerce.number().int().min(1, "Question order must be at least 1."),
  questionType: z.string().trim().min(1, "Question type is required."),
  prompt: z.string().trim().min(1, "Question prompt is required."),
  optionsJson: z.string().trim().optional(),
  correctAnswerJson: z.string().trim().optional(),
  explanation: z.string().trim().optional(),
  points: z.coerce.number().int().min(1, "Points must be at least 1.")
});

const idSchema = z.string().trim().min(1);

function optionalText(value?: string) {
  return value ? value : null;
}

function optionalJson(value: string | undefined, label: string) {
  if (!value) {
    return null;
  }

  try {
    return JSON.stringify(JSON.parse(value));
  } catch {
    throw new Error(`${label} must be valid JSON.`);
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
      throw new Error("Metadata JSON must be valid JSON.");
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

export async function createMaterial(formData: FormData) {
  const teacher = await requireTeacher();
  const parsed = materialSchema.safeParse({
    title: formData.get("title"),
    skill: formData.get("skill"),
    sourceLabel: formData.get("sourceLabel"),
    description: formData.get("description")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid material details.");
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
}

export async function updateMaterial(formData: FormData) {
  const teacher = await requireTeacher();
  const id = idSchema.parse(formData.get("materialId"));
  const parsed = materialSchema.safeParse({
    title: formData.get("title"),
    skill: formData.get("skill"),
    sourceLabel: formData.get("sourceLabel"),
    description: formData.get("description")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid material details.");
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
    throw new Error("Material not found for this teacher.");
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
}

export async function deleteMaterial(formData: FormData) {
  const teacher = await requireTeacher();
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
    redirect(materialNoticePath("error", "Material not found for this teacher."));
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
  redirect(
    materialNoticePath(
      "success",
      answerCount > 0 || assignedCount > 0
        ? `Đã xoá tài liệu (kèm ${answerCount} câu trả lời của học sinh${
            assignedCount > 0 ? `, gỡ khỏi ${assignedCount} lượt giao bài` : ""
          }).`
        : "Đã xoá tài liệu."
    )
  );
}

export async function createUnit(formData: FormData) {
  const teacher = await requireTeacher();
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
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid unit details.");
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
    throw new Error("Material not found for this teacher.");
  }

  await prisma.assignableUnit.create({
    data: {
      materialId: material.id,
      skill: material.skill,
      unitType: parsed.data.unitType,
      unitNumber: parsed.data.unitNumber,
      title: parsed.data.title,
      instructions: optionalText(parsed.data.instructions),
      content: parsed.data.content,
      audioUrl: optionalText(parsed.data.audioUrl),
      transcript: optionalText(parsed.data.transcript),
      defaultTimeLimitMinutes: parsed.data.defaultTimeLimitMinutes ?? null,
      metadataJson: buildUnitMetadata(parsed.data.metadataJson, parsed.data.imageUrlsJson)
    }
  });

  revalidatePath("/teacher/materials");
}

export async function updateUnit(formData: FormData) {
  const teacher = await requireTeacher();
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
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid unit details.");
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
    throw new Error("Material not found for this teacher.");
  }

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
      content: parsed.data.content,
      audioUrl: optionalText(parsed.data.audioUrl),
      transcript: optionalText(parsed.data.transcript),
      defaultTimeLimitMinutes: parsed.data.defaultTimeLimitMinutes ?? null,
      metadataJson: buildUnitMetadata(parsed.data.metadataJson, parsed.data.imageUrlsJson)
    }
  });

  if (result.count === 0) {
    throw new Error("Unit not found for this teacher.");
  }

  revalidatePath("/teacher/materials");
}

export async function deleteUnit(formData: FormData) {
  const teacher = await requireTeacher();
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
    redirect(materialNoticePath("error", "Unit not found for this teacher."));
  }

  if (unit._count.assignmentUnits > 0 || unit._count.answers > 0 || unit._count.highlights > 0) {
    redirect(
      materialNoticePath(
        "error",
        "Cannot delete this unit because it has assigned work or submitted answers."
      )
    );
  }

  await prisma.assignableUnit.delete({
    where: { id: unit.id }
  });

  revalidatePath("/teacher/materials");
  redirect(materialNoticePath("success", "Unit deleted."));
}

export async function createQuestion(formData: FormData) {
  const teacher = await requireTeacher();
  const parsed = questionSchema.safeParse({
    assignableUnitId: formData.get("assignableUnitId"),
    order: formData.get("order"),
    questionType: formData.get("questionType"),
    prompt: formData.get("prompt"),
    optionsJson: formData.get("optionsJson"),
    correctAnswerJson: formData.get("correctAnswerJson"),
    explanation: formData.get("explanation"),
    points: formData.get("points")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid question details.");
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
    throw new Error("Unit not found for this teacher.");
  }

  await prisma.question.create({
    data: {
      assignableUnitId: unit.id,
      order: parsed.data.order,
      questionType: parsed.data.questionType,
      prompt: parsed.data.prompt,
      optionsJson: optionalJson(parsed.data.optionsJson, "Options JSON"),
      correctAnswerJson: optionalJson(parsed.data.correctAnswerJson, "Correct answer JSON"),
      explanation: optionalText(parsed.data.explanation),
      points: parsed.data.points
    }
  });

  revalidatePath("/teacher/materials");
}

export async function updateQuestion(formData: FormData) {
  const teacher = await requireTeacher();
  const id = idSchema.parse(formData.get("questionId"));
  const parsed = questionSchema.safeParse({
    assignableUnitId: formData.get("assignableUnitId"),
    order: formData.get("order"),
    questionType: formData.get("questionType"),
    prompt: formData.get("prompt"),
    optionsJson: formData.get("optionsJson"),
    correctAnswerJson: formData.get("correctAnswerJson"),
    explanation: formData.get("explanation"),
    points: formData.get("points")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid question details.");
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
    throw new Error("Unit not found for this teacher.");
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
      optionsJson: optionalJson(parsed.data.optionsJson, "Options JSON"),
      correctAnswerJson: optionalJson(parsed.data.correctAnswerJson, "Correct answer JSON"),
      explanation: optionalText(parsed.data.explanation),
      points: parsed.data.points
    }
  });

  if (result.count === 0) {
    throw new Error("Question not found for this teacher.");
  }

  revalidatePath("/teacher/materials");
}

export async function deleteQuestion(formData: FormData) {
  const teacher = await requireTeacher();
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
      id: true
    }
  });

  if (!question) {
    redirect(materialNoticePath("error", "Question not found for this teacher."));
  }

  await prisma.question.delete({
    where: { id: question.id }
  });

  revalidatePath("/teacher/materials");
  redirect(materialNoticePath("success", "Question deleted."));
}

const importScalar = z.union([z.string(), z.number(), z.boolean()]);

const importQuestionSchema = z.object({
  order: z.number().int().min(1),
  questionType: z.enum(questionTypes),
  prompt: z.string().trim().min(1),
  options: z.array(importScalar).optional(),
  answer: z.union([importScalar, z.array(importScalar)]).optional(),
  explanation: z.string().trim().optional(),
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

      if (answers.length === 0 && question.questionType !== "writing_task") {
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

  await prisma.material.create({
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
              points: question.points
            }))
          }
        }))
      }
    }
  });

  revalidatePath("/teacher");
  revalidatePath("/teacher/materials");
  redirect(
    materialNoticePath(
      "success",
      `Đã import "${data.title}": ${data.units.length} phần, ${questionCount} câu hỏi.`
    )
  );
}
