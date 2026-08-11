// Quét transcript Listening + passage Reading đang có trong DB, lọc ra từ học
// thuật, gọi Claude API điền nghĩa/phiên âm rồi ghi vào bảng VocabWord.
//
// Chạy lại được nhiều lần: từ đã có trong DB sẽ bị bỏ qua, nên đứt mạng giữa
// chừng chỉ cần chạy lại.
//
//   npx tsx scripts/vocab-extract.ts --dry-run
//   npx tsx scripts/vocab-extract.ts
//   DATABASE_URL=$DATABASE_URL_PROD npx tsx scripts/vocab-extract.ts
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import { warmUpDatabase } from "../lib/db-warmup";
import { extractCandidates, type VocabCandidate } from "../lib/vocab-extract";

const BATCH_SIZE = 50;
const MODEL = "claude-opus-5";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

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

async function main() {
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
    console.log(todo.slice(0, 30).map((item) => item.word).join(", "));
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
          sourceUnitId: source.unitId,
          sourceSkill: source.skill
        }
      });

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
