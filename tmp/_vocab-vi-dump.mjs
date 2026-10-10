// Xuất câu ví dụ trong kho từ (prod, CHỈ ĐỌC) → TSV id \t từ \t nghĩa \t câu.
// node tmp/_vocab-vi-dump.mjs <out.tsv>
import { PrismaClient } from "@prisma/client";
import fs from "fs";

const env = fs.readFileSync(".env", "utf8");
const url = env.match(/^DATABASE_URL_PROD="?([^"\n]+)"?/m)[1];
const p = new PrismaClient({ datasources: { db: { url } } });

const rows = await p.vocabWord.findMany({
  orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  select: { id: true, display: true, meaningVi: true, exampleEn: true, hidden: true }
});
const clean = (s) => s.replace(/[\t\r\n]+/g, " ").trim();
fs.writeFileSync(
  process.argv[2],
  rows.map((r) => [r.id, r.display, clean(r.meaningVi), clean(r.exampleEn)].join("\t")).join("\n") + "\n",
  "utf8"
);
console.log("Tổng:", rows.length, "· đang ẩn:", rows.filter((r) => r.hidden).length);
await p.$disconnect();
