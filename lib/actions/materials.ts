"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeacher } from "@/lib/actions/classes";
import { prisma } from "@/lib/prisma";

const skills = ["listening", "reading", "writing", "speaking"] as const;
const unitTypes = ["listening_part", "reading_passage", "writing_task", "speaking_part"] as const;

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
  metadataJson: z.string().trim().optional()
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
    metadataJson: formData.get("metadataJson")
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
      metadataJson: optionalJson(parsed.data.metadataJson, "Metadata JSON")
    }
  });

  revalidatePath("/teacher/materials");
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
