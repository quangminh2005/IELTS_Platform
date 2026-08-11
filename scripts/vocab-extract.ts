// Quét transcript Listening + passage Reading đang có trong DB, lọc ra từ học
// thuật rồi ghi vào bảng VocabWord kèm nghĩa/phiên âm.
//
// Chạy lại được nhiều lần: từ đã có trong DB sẽ bị bỏ qua, nên đứt giữa chừng
// chỉ cần chạy lại.
//
// BỐN CHẾ ĐỘ:
//   --dry-run              chỉ liệt kê từ lọc được, không ghi gì
//   --emit <file.json>     xuất danh sách từ + câu ví dụ ra file để soạn nghĩa tay
//   --import <file.json>   nhập file đã soạn nghĩa vào DB (KHÔNG cần API key)
//   (không cờ nào)         gọi Claude API tự điền nghĩa — cần ANTHROPIC_API_KEY
//
// Thêm --prod để chạy trên database production (DATABASE_URL_PROD).
//
//   npx tsx scripts/vocab-extract.ts --prod --emit tmp/vocab-candidates.json
//   npx tsx scripts/vocab-extract.ts --prod --import tmp/vocab-filled.json
import { readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import { warmUpDatabase } from "../lib/db-warmup";
import { extractCandidates, type VocabCandidate } from "../lib/vocab-extract";

const BATCH_SIZE = 50;
const MODEL = "claude-opus-5";

function flagValue(name: string): string | null {
  const index = process.argv.indexOf(name);

  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

const dryRun = process.argv.includes("--dry-run");
const useProd = process.argv.includes("--prod");
const emitPath = flagValue("--emit");
const importPath = flagValue("--import");

if (useProd && !process.env.DATABASE_URL_PROD) {
  throw new Error("Thiếu DATABASE_URL_PROD trong môi trường.");
}

// datasourceUrl undefined => Prisma tự đọc DATABASE_URL từ .env như bình thường.
const prisma = new PrismaClient({
  datasourceUrl: useProd ? process.env.DATABASE_URL_PROD : undefined
});

type Filled = {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaningVi: string;
  definitionEn: string;
};

// Structured output: bắt Claude trả đúng khuôn này, khỏi phải vá lỗi parse.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    words: {
      type: "array",
      items: {
        type: "object",
        properties: {
          word: { type: "string" },
          phonetic: { type: "string" },
          partOfSpeech: {
            type: "string",
            enum: ["noun", "verb", "adjective", "adverb"]
          },
          meaningVi: { type: "string" },
          definitionEn: { type: "string" }
        },
        required: ["word", "phonetic", "partOfSpeech", "meaningVi", "definitionEn"],
        additionalProperties: false
      }
    }
  },
  required: ["words"],
  additionalProperties: false
} as const;

async function fillMeanings(
  client: Anthropic,
  batch: VocabCandidate[]
): Promise<Filled[]> {
  const listing = batch
    .map((item) => `- ${item.word} — trong câu: "${item.sentence}"`)
    .join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: RESPONSE_SCHEMA }
    },
    system:
      "Bạn giúp một giáo viên IELTS người Việt soạn từ điển cho học viên. " +
      "Với mỗi từ, đưa nghĩa tiếng Việt ngắn gọn ĐÚNG VỚI NGỮ CẢNH của câu ví dụ " +
      "được cung cấp, phiên âm IPA (kèm hai dấu gạch chéo), loại từ, và một định " +
      "nghĩa tiếng Anh ngắn. Giữ nguyên chính tả của từ trong trường word.",
    messages: [
      {
        role: "user",
        content: `Điền thông tin cho ${batch.length} từ sau:\n\n${listing}`
      }
    ]
  });

  const text = response.content.find((block) => block.type === "text");

  if (!text || text.type !== "text") {
    throw new Error("Claude không trả về nội dung văn bản.");
  }

  return (JSON.parse(text.text) as { words: Filled[] }).words;
}

// Ghi một từ đã có đủ nghĩa vào DB. Dùng chung cho cả nhánh gọi API lẫn nhánh
// nhập file soạn tay.
async function saveWord(item: Filled, source: VocabCandidate) {
  await prisma.vocabWord.upsert({
    where: { word: source.word },
    update: {},
    create: {
      word: source.word,
      display: item.word,
      phonetic: item.phonetic,
      partOfSpeech: item.partOfSpeech,
      meaningVi: item.meaningVi,
      definitionEn: item.definitionEn,
      exampleEn: source.sentence,
      // Chuỗi rỗng sẽ làm hỏng khoá ngoại — quy về null.
      sourceUnitId: source.unitId || null,
      sourceSkill: source.skill || null
    }
  });
}

// Nhập file đã soạn nghĩa tay. Mỗi phần tử là một Filled kèm đủ thông tin nguồn,
// nên không cần quét lại đề — nhập được cả những từ đã bị người soạn sửa lại mặt
// chữ (vd "distributed" -> "distribute").
type FilledWithSource = Filled & {
  key: string; // khoá chuẩn hoá, dùng làm VocabWord.word
  sentence: string;
  unitId: string | null;
  skill: string | null;
};

async function importFilled(path: string) {
  const rows = JSON.parse(readFileSync(path, "utf8")) as FilledWithSource[];

  console.log(`Đọc ${rows.length} từ từ ${path}.`);

  let saved = 0;

  for (const row of rows) {
    await saveWord(row, {
      word: row.key,
      display: row.word,
      root: row.key,
      sentence: row.sentence,
      unitId: row.unitId ?? "",
      skill: row.skill ?? ""
    });
    saved += 1;
  }

  console.log(`Đã ghi ${saved} từ vào DB.`);
}

async function main() {
  if (importPath) {
    await importFilled(importPath);
    return;
  }

  // Neon ngủ khi vắng người dùng — đánh thức trước, nếu không truy vấn đầu tiên
  // hay chết vì chưa kết nối kịp (xem lib/db-warmup.ts).
  const attempts = await warmUpDatabase(() => prisma.$queryRaw`SELECT 1`);

  if (attempts > 1) {
    console.warn(`DB tỉnh sau ${attempts} lần thử.`);
  }

  const units = await prisma.assignableUnit.findMany({
    where: { skill: { in: ["listening", "reading"] } },
    select: { id: true, skill: true, content: true, transcript: true }
  });

  console.log(`Đọc ${units.length} phần đề.`);

  const candidates = new Map<string, VocabCandidate>();

  for (const unit of units) {
    const text = unit.skill === "listening" ? unit.transcript : unit.content;

    if (!text) {
      continue;
    }

    for (const candidate of extractCandidates({
      text,
      skill: unit.skill,
      unitId: unit.id
    })) {
      // Gom theo GỐC chứ không theo mặt chữ: hai phần đề khác nhau có thể cho
      // "computer" và "computers", chỉ giữ dạng ngắn hơn.
      const kept = candidates.get(candidate.root);

      if (!kept || candidate.word.length < kept.word.length) {
        candidates.set(candidate.root, candidate);
      }
    }
  }

  const existing = await prisma.vocabWord.findMany({ select: { word: true } });
  const known = new Set(existing.map((row) => row.word));
  const todo = [...candidates.values()].filter((item) => !known.has(item.word));

  console.log(
    `Lọc được ${candidates.size} từ, trong đó ${todo.length} từ chưa có trong DB.`
  );

  if (dryRun) {
    console.log(todo.map((item) => item.word).sort().join(", "));
    return;
  }

  if (emitPath) {
    // Xuất ra file để soạn nghĩa bằng tay (hoặc nhờ Claude soạn trong phiên chat),
    // rồi nhập lại bằng --import. Đây là đường đi KHÔNG cần API key.
    const rows = todo
      .map((item) => ({
        key: item.word,
        word: item.word,
        phonetic: "",
        partOfSpeech: "",
        meaningVi: "",
        definitionEn: "",
        sentence: item.sentence,
        unitId: item.unitId,
        skill: item.skill
      }))
      .sort((left, right) => left.key.localeCompare(right.key));

    writeFileSync(emitPath, JSON.stringify(rows, null, 2), "utf8");
    console.log(`Đã xuất ${rows.length} từ ra ${emitPath}.`);
    return;
  }

  if (todo.length === 0) {
    return;
  }

  const client = new Anthropic();
  let saved = 0;

  for (let start = 0; start < todo.length; start += BATCH_SIZE) {
    const batch = todo.slice(start, start + BATCH_SIZE);
    const bySource = new Map(batch.map((item) => [item.word, item]));

    let filled: Filled[];

    try {
      filled = await fillMeanings(client, batch);
    } catch (error) {
      // Một lô hỏng không được làm chết cả lượt chạy — bỏ qua, lần chạy sau sẽ
      // nhặt lại vì các từ này vẫn chưa có trong DB.
      console.error(`Lô bắt đầu từ ${start} lỗi, bỏ qua:`, error);
      continue;
    }

    for (const item of filled) {
      const source = bySource.get(item.word.toLowerCase());

      if (!source) {
        console.warn(`Bỏ qua "${item.word}": không khớp từ nào đã gửi đi.`);
        continue;
      }

      await saveWord(item, source);
      saved += 1;
    }

    console.log(`Đã lưu ${saved}/${todo.length} từ.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
