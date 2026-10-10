// (1) Ghi bản dịch câu ví dụ cho kho từ prod (tmp/vocab-vi-backfill.json, ghép theo id
//     VÀ mặt chữ — lệch là dừng) và (2) thêm từ mới vào kho chung, không phát cho lớp nào.
// Cần cột VocabWord.exampleVi (scripts/ensure-db.mjs tạo khi deploy).
// node tmp/_vocab-vi-apply.mjs <từ-mới.json> [--write]
import { PrismaClient } from "@prisma/client";
import fs from "fs";

const [newFile] = process.argv.slice(2);
const write = process.argv.includes("--write");
const env = fs.readFileSync(".env", "utf8");
const url = env.match(/^DATABASE_URL_PROD="?([^"\n]+)"?/m)[1];
const p = new PrismaClient({ datasources: { db: { url } } });

const backfill = JSON.parse(fs.readFileSync("tmp/vocab-vi-backfill.json", "utf8"));
const fresh = JSON.parse(fs.readFileSync(newFile, "utf8"));

for (const w of fresh) {
  if (!new RegExp(`\\b${w.display}\\b`, "i").test(w.exampleEn)) {
    throw new Error("Câu ví dụ thiếu từ: " + w.display);
  }
  if (!w.exampleVi?.trim()) throw new Error("Chưa dịch câu ví dụ: " + w.display);
}

const col = await p.$queryRawUnsafe(
  `SELECT 1 FROM information_schema.columns WHERE table_name = 'VocabWord' AND column_name = 'exampleVi'`
);
if (col.length === 0) throw new Error("Prod chưa có cột exampleVi — chờ deploy xong (ensure-db).");

const rows = await p.vocabWord.findMany({ select: { id: true, word: true, display: true, exampleVi: true } });
const byId = new Map(rows.map((r) => [r.id, r]));
const mismatched = backfill.filter((b) => byId.get(b.id)?.display !== b.display);
if (mismatched.length > 0) throw new Error("Lệch id/mặt chữ: " + mismatched.map((m) => m.display).join(", "));

const toFill = backfill.filter((b) => !byId.get(b.id).exampleVi);
const have = new Set(rows.map((r) => r.word));
const toAdd = fresh.filter((w) => !have.has(w.display.toLowerCase()));
const notTranslated = rows.filter((r) => !r.exampleVi && !backfill.some((b) => b.id === r.id));

console.log({
  banDichCanGhi: toFill.length,
  daCoBanDich: backfill.length - toFill.length,
  tuChuaCoTrongFileDich: notTranslated.map((r) => r.display),
  tuMoi: toAdd.map((w) => w.display),
  daCoTrongKho: fresh.filter((w) => have.has(w.display.toLowerCase())).map((w) => w.display)
});

if (!write) {
  console.log("Chạy thử — thêm --write để ghi.");
  await p.$disconnect();
  process.exit(0);
}

for (let i = 0; i < toFill.length; i += 50) {
  await p.$transaction(
    toFill.slice(i, i + 50).map((b) => p.vocabWord.update({ where: { id: b.id }, data: { exampleVi: b.exampleVi } }))
  );
}

for (const w of toAdd) {
  await p.vocabWord.create({
    data: {
      word: w.display.toLowerCase(),
      display: w.display,
      phonetic: w.phonetic,
      partOfSpeech: w.partOfSpeech,
      meaningVi: w.meaningVi,
      definitionEn: w.definitionEn,
      exampleEn: w.exampleEn,
      exampleVi: w.exampleVi,
      sourceSkill: "manual"
    }
  });
}

const left = await p.vocabWord.count({ where: { OR: [{ exampleVi: null }, { exampleVi: "" }] } });
console.log("Đã ghi", toFill.length, "bản dịch +", toAdd.length, "từ mới. Còn chưa dịch:", left);
await p.$disconnect();
