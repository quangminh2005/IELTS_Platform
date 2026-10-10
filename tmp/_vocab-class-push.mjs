// Nạp từ vựng buổi học vào kho + phát thẻ ôn (đến hạn hôm nay) cho cả lớp.
// Mặc định chạy thử; thêm --write mới ghi lên prod.
// node tmp/_vocab-class-push.mjs <file.json> "<tên lớp>" [--write]
import { PrismaClient } from "@prisma/client";
import fs from "fs";

const [file, className] = process.argv.slice(2);
const write = process.argv.includes("--write");
const env = fs.readFileSync(".env", "utf8");
const url = env.match(/^DATABASE_URL_PROD="?([^"\n]+)"?/m)[1];
const p = new PrismaClient({ datasources: { db: { url } } });
const words = JSON.parse(fs.readFileSync(file, "utf8"));

// Câu ví dụ phải chứa đúng từ, không thì dạng "điền từ vào câu" không khoét được.
for (const w of words) {
  if (!new RegExp(`\\b${w.display}\\b`, "i").test(w.exampleEn)) {
    throw new Error("Câu ví dụ thiếu từ: " + w.display);
  }
  if (!w.exampleVi?.trim()) {
    throw new Error("Chưa dịch câu ví dụ: " + w.display);
  }
}

const cls = await p.class.findFirst({
  where: { name: className },
  select: {
    name: true,
    students: { select: { student: { select: { id: true, displayName: true } } } }
  }
});
if (!cls) throw new Error("Không thấy lớp " + className);

const students = cls.students.map((s) => s.student);
const existing = await p.vocabWord.findMany({
  where: { word: { in: words.map((w) => w.display.toLowerCase()) } },
  select: { id: true, word: true }
});
const have = new Map(existing.map((e) => [e.word, e.id]));
const todayKey = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const dueDate = new Date(todayKey + "T00:00:00.000Z");

console.log({
  lop: cls.name,
  hocVien: students.map((s) => s.displayName),
  tuMoi: words.filter((w) => !have.has(w.display.toLowerCase())).map((w) => w.display),
  daCoTrongKho: [...have.keys()],
  denHan: todayKey
});

if (!write) {
  console.log("Chạy thử — thêm --write để ghi.");
  await p.$disconnect();
  process.exit(0);
}

for (const w of words) {
  const key = w.display.toLowerCase();
  if (have.has(key)) continue;
  const row = await p.vocabWord.create({
    data: {
      word: key,
      display: w.display,
      phonetic: w.phonetic,
      partOfSpeech: w.partOfSpeech,
      meaningVi: w.meaningVi,
      definitionEn: w.definitionEn,
      exampleEn: w.exampleEn,
      exampleVi: w.exampleVi,
      sourceSkill: "manual"
    },
    select: { id: true }
  });
  have.set(key, row.id);
}

// source "teacher": không tính vào hạn mức 5 thẻ mới/ngày, học viên không xoá được.
const data = [];
for (const s of students) {
  for (const w of words) {
    const key = w.display.toLowerCase();
    data.push({ studentId: s.id, wordKey: key, source: "teacher", wordId: have.get(key), box: 0, dueDate });
  }
}
const res = await p.vocabDeckCard.createMany({ data, skipDuplicates: true });
console.log("Đã tạo thẻ:", res.count, "/", data.length);
await p.$disconnect();
