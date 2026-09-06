// Import "Listening Practice Through Dictation 3" thẳng lên DB prod.
// Tạo Material trước, rồi thêm TỪNG unit một (8.000+ câu, ghi một lần dễ timeout).
//
//   node tmp/lptd3_import_prod.mjs            -> chỉ kiểm tra, không ghi
//   node tmp/lptd3_import_prod.mjs --write    -> ghi lên prod
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const FILE = "E:/web_ielts/tmp/lptd3_listening.json";
const DO_WRITE = process.argv.includes("--write");

const envText = fs.readFileSync("E:/web_ielts/.env", "utf8");
const prodUrl = envText
  .split(/\r?\n/)
  .find((line) => line.trim().startsWith("DATABASE_URL_PROD="))
  ?.slice("DATABASE_URL_PROD=".length)
  .trim()
  .replace(/^["']|["']$/g, "");
if (!prodUrl) throw new Error("Không tìm thấy DATABASE_URL_PROD trong .env");

const prisma = new PrismaClient({ datasources: { db: { url: prodUrl } } });
const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
const optionalText = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

const teacher = await prisma.teacherProfile.findFirst({
  select: { id: true, displayName: true }
});
if (!teacher) throw new Error("Không tìm thấy TeacherProfile trên prod.");

const existing = await prisma.material.findFirst({
  where: { title: data.title },
  select: { id: true }
});
if (existing) throw new Error(`Đã có tài liệu trùng tên "${data.title}" (id ${existing.id}).`);

const totalQuestions = data.units.reduce((s, u) => s + u.questions.length, 0);
console.log(
  `${data.title}: ${data.units.length} unit, ${totalQuestions} câu · giáo viên ${teacher.displayName}`
);
if (!DO_WRITE) {
  console.log("Chạy lại với --write để ghi lên prod.");
  await prisma.$disconnect();
  process.exit(0);
}

const material = await prisma.material.create({
  data: {
    teacherId: teacher.id,
    skill: data.skill,
    title: data.title,
    sourceLabel: optionalText(data.sourceLabel),
    description: optionalText(data.description)
  },
  select: { id: true }
});
console.log(`Đã tạo Material ${material.id}`);

for (const unit of data.units) {
  await prisma.assignableUnit.create({
    data: {
      materialId: material.id,
      skill: data.skill,
      unitType: unit.unitType,
      unitNumber: unit.unitNumber,
      title: unit.title,
      instructions: optionalText(unit.instructions),
      content: unit.content,
      audioUrl: optionalText(unit.audioUrl),
      transcript: optionalText(unit.transcript),
      defaultTimeLimitMinutes: unit.defaultTimeLimitMinutes ?? null,
      metadataJson: unit.metadata == null ? null : JSON.stringify(unit.metadata),
      questions: {
        create: unit.questions.map((q) => ({
          order: q.order,
          questionType: q.questionType,
          prompt: q.prompt,
          optionsJson:
            q.options && q.options.length > 0 ? JSON.stringify(q.options.map(String)) : null,
          correctAnswerJson: q.answer === undefined ? null : JSON.stringify(q.answer),
          explanation: optionalText(q.explanation),
          answerEvidence: optionalText(q.evidence),
          points: q.points ?? 1
        }))
      }
    }
  });
  console.log(`  unit ${String(unit.unitNumber).padStart(2)} · ${unit.questions.length} câu`);
}

const check = await prisma.assignableUnit.count({ where: { materialId: material.id } });
const qCount = await prisma.question.count({ where: { unit: { materialId: material.id } } });
console.log(`\nXong: ${check} unit, ${qCount} câu trên prod (material ${material.id}).`);

await prisma.$disconnect();
