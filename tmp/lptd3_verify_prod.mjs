// Kiem tra tai lieu LPTD 3 tren prod: du unit / du cau / du audio chua.
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const envText = fs.readFileSync("E:/web_ielts/.env", "utf8");
const prodUrl = envText.split(/\r?\n/)
  .find((l) => l.trim().startsWith("DATABASE_URL_PROD="))
  ?.slice("DATABASE_URL_PROD=".length).trim().replace(/^["']|["']$/g, "");
const prisma = new PrismaClient({ datasources: { db: { url: prodUrl } } });

const m = await prisma.material.findFirst({
  where: { title: "Listening Practice Through Dictation 3" },
  select: { id: true, title: true, skill: true, sourceLabel: true }
});
console.log(m);

const units = await prisma.assignableUnit.findMany({
  where: { materialId: m.id },
  orderBy: { unitNumber: "asc" },
  select: {
    id: true, unitNumber: true, title: true, audioUrl: true,
    transcript: true, transcriptTimingJson: true, metadataJson: true,
    _count: { select: { questions: true } }
  }
});
let total = 0;
for (const u of units) {
  total += u._count.questions;
  const md = u.metadataJson ? JSON.parse(u.metadataJson) : {};
  const groups = Object.keys(md.groupTitles ?? {}).length;
  console.log(
    `${String(u.unitNumber).padStart(2)} ${u.title.slice(0, 32).padEnd(34)} cau=${String(u._count.questions).padStart(3)}` +
    ` nhom=${groups} audio=${u.audioUrl ? "co" : "THIEU"} transcript=${u.transcript ? "co" : "THIEU"}` +
    ` timing=${u.transcriptTimingJson ? "co" : "chua"}`
  );
}
console.log(`\n${units.length} unit, ${total} cau.`);
await prisma.$disconnect();
