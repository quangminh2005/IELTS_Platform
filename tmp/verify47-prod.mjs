// Kiểm tra đề Listening Test 47 sau khi import thẳng lên prod.
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const envText = fs.readFileSync("E:/web_ielts/.env", "utf8");
const prodUrl = envText
  .split(/\r?\n/)
  .find((line) => line.trim().startsWith("DATABASE_URL_PROD="))
  ?.slice("DATABASE_URL_PROD=".length)
  .trim()
  .replace(/^["']|["']$/g, "");

const prisma = new PrismaClient({ datasources: { db: { url: prodUrl } } });

const material = await prisma.material.findFirst({
  where: { title: "IELTS Master - Listening Test 47" },
  select: {
    id: true,
    title: true,
    skill: true,
    units: {
      orderBy: { unitNumber: "asc" },
      select: {
        id: true,
        unitNumber: true,
        title: true,
        audioUrl: true,
        transcript: true,
        transcriptTimingJson: true,
        metadataJson: true,
        questions: {
          orderBy: { order: "asc" },
          select: {
            order: true,
            questionType: true,
            correctAnswerJson: true,
            explanation: true,
            answerEvidence: true
          }
        }
      }
    }
  }
});

if (!material) {
  console.error("Không tìm thấy tài liệu trên prod.");
  process.exit(1);
}

console.log(`${material.title} (${material.id}) — skill=${material.skill}`);
let totalQ = 0;
let missingExpl = 0;
let missingEv = 0;

for (const unit of material.units) {
  totalQ += unit.questions.length;
  const noExpl = unit.questions.filter((q) => !q.explanation).length;
  const noEv = unit.questions.filter((q) => !q.answerEvidence).length;
  missingExpl += noExpl;
  missingEv += noEv;
  console.log(
    `  Phần ${unit.unitNumber}: ${unit.questions.length} câu` +
      ` | audio ${unit.audioUrl ? "có" : "THIẾU"}` +
      ` | transcript ${unit.transcript ? unit.transcript.length + " ký tự" : "THIẾU"}` +
      ` | timing ${unit.transcriptTimingJson ? "có" : "chưa có"}` +
      ` | thiếu giải thích ${noExpl} | thiếu dẫn chứng ${noEv}`
  );
}

console.log(`Tổng: ${material.units.length} phần, ${totalQ} câu.`);
console.log(`Thiếu giải thích: ${missingExpl} | thiếu dẫn chứng: ${missingEv}`);

// Đối chiếu đáp án với đáp án gốc trong file JSON đã dựng.
const local = JSON.parse(
  fs.readFileSync("E:/web_ielts/tmp/ielts_master_listening_test47.json", "utf8")
);
const want = new Map();
for (const u of local.units) {
  for (const q of u.questions) want.set(q.order, JSON.stringify(q.answer));
}
let mismatch = 0;
for (const unit of material.units) {
  for (const q of unit.questions) {
    if (q.correctAnswerJson !== want.get(q.order)) {
      mismatch += 1;
      console.log(`  LỆCH câu ${q.order}: prod=${q.correctAnswerJson} | file=${want.get(q.order)}`);
    }
  }
}
console.log(`Đáp án lệch so với file: ${mismatch}`);

// Kiểm tra audio thật sự tải được.
for (const unit of material.units) {
  const res = await fetch(unit.audioUrl, { method: "HEAD" });
  console.log(
    `  audio phần ${unit.unitNumber}: HTTP ${res.status}, ${res.headers.get("content-type")}, ` +
      `${(Number(res.headers.get("content-length")) / 1048576).toFixed(1)} MB`
  );
}

await prisma.$disconnect();
