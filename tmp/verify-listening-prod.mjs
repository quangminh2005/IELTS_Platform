// Kiểm tra đề Listening sau khi import thẳng lên prod. Dùng: node tmp/verify-listening-prod.mjs 48 49 50
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

for (const n of process.argv.slice(2)) {
  const title = `IELTS Master - Listening Test ${n}`;
  const m = await prisma.material.findFirst({
    where: { title },
    select: {
      id: true, category: true, bookName: true,
      units: {
        orderBy: { unitNumber: "asc" },
        select: {
          unitNumber: true, audioUrl: true, transcript: true, transcriptTimingJson: true,
          questions: { orderBy: { order: "asc" }, select: { order: true, correctAnswerJson: true, explanation: true, answerEvidence: true } }
        }
      }
    }
  });
  if (!m) { console.log(`${title}: KHÔNG THẤY`); continue; }
  const local = JSON.parse(fs.readFileSync(`E:/web_ielts/tmp/ielts_master_listening_test${n}.json`, "utf8"));
  const want = new Map(local.units.flatMap((u) => u.questions.map((q) => [q.order, JSON.stringify(q.answer)])));
  let total = 0, lech = 0, thieu = 0;
  const parts = [];
  for (const u of m.units) {
    total += u.questions.length;
    for (const q of u.questions) {
      if (q.correctAnswerJson !== want.get(q.order)) lech += 1;
      if (!q.explanation || !q.answerEvidence) thieu += 1;
    }
    const res = await fetch(u.audioUrl, { method: "HEAD" });
    parts.push(`P${u.unitNumber}: ${u.questions.length}c, audio ${res.status} ${(Number(res.headers.get("content-length")) / 1048576).toFixed(1)}MB, timing ${u.transcriptTimingJson ? "có" : "THIẾU"}`);
  }
  console.log(`${title} [${m.category} / ${m.bookName}] — ${total} câu, lệch ${lech}, thiếu giải thích/dẫn chứng ${thieu}`);
  for (const p of parts) console.log("   " + p);
}
await prisma.$disconnect();
