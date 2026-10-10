// Ghi lại metadataJson (noteBody/ảnh) cho các part Test 48-50 trên prod nếu khác file JSON.
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
const env = fs.readFileSync("E:/web_ielts/.env", "utf8");
const url = env.split(/\r?\n/).find((l) => l.trim().startsWith("DATABASE_URL_PROD=")).slice(18).trim().replace(/^["']|["']$/g, "");
const prisma = new PrismaClient({ datasources: { db: { url } } });
for (const n of [48, 49, 50]) {
  const local = JSON.parse(fs.readFileSync(`tmp/ielts_master_listening_test${n}.json`, "utf8"));
  const m = await prisma.material.findFirst({ where: { title: local.title }, select: { units: { select: { id: true, unitNumber: true, metadataJson: true } } } });
  for (const u of local.units) {
    const row = m.units.find((x) => x.unitNumber === u.unitNumber);
    const next = JSON.stringify(u.metadata);
    if (row.metadataJson !== next) {
      await prisma.assignableUnit.update({ where: { id: row.id }, data: { metadataJson: next } });
      console.log(`Test ${n} phần ${u.unitNumber}: đã cập nhật`);
    }
  }
}
await prisma.$disconnect();
