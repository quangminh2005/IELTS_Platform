// Backfill mốc thời gian transcript<->audio cho các phần Listening đã có sẵn
// trong DB (đề import trước khi có tính năng bấm transcript để tua audio).
//
// Chạy:  npx tsx scripts/backfill-transcript-timing.ts
// Cần:   DATABASE_URL (DB muốn backfill) + GROQ_API_KEY trong môi trường/.env
// Tùy chọn: --force  đồng bộ lại cả phần ĐÃ có timing (mặc định chỉ phần thiếu).
//
// Chạy tuần tự từng phần (nhẹ nhàng với rate limit của Groq), in tỷ lệ khớp để
// phát hiện phần có audio không đúng nội dung (ví dụ file gộp cả 4 part).

import { prisma } from "@/lib/prisma";
import { syncTranscriptTiming } from "@/lib/transcript-sync";

const force = process.argv.includes("--force");

async function main() {
  if (!process.env.GROQ_API_KEY) {
    console.error("Thiếu GROQ_API_KEY — thêm vào .env rồi chạy lại.");
    process.exit(1);
  }

  const units = await prisma.assignableUnit.findMany({
    where: {
      skill: "listening",
      audioUrl: { not: null },
      transcript: { not: null },
      ...(force ? {} : { transcriptTimingJson: null })
    },
    orderBy: [{ materialId: "asc" }, { unitNumber: "asc" }],
    select: {
      id: true,
      title: true,
      unitNumber: true,
      material: { select: { title: true } }
    }
  });

  console.log(`Cần đồng bộ ${units.length} phần nghe${force ? " (--force)" : ""}.`);

  let okCount = 0;
  const failures: string[] = [];

  for (const unit of units) {
    const label = `${unit.material.title} · Phần ${unit.unitNumber} (${unit.title})`;
    try {
      const result = await syncTranscriptTiming(unit.id);
      if (result.ok) {
        okCount += 1;
        console.log(`  OK   ${label} — khớp ${Math.round(result.matchRatio * 100)}%`);
      } else {
        failures.push(`${label}: ${result.error}`);
        console.warn(`  LỖI  ${label} — ${result.error}`);
      }
    } catch (error) {
      const message = (error as Error).message;
      failures.push(`${label}: ${message}`);
      console.warn(`  LỖI  ${label} — ${message}`);
    }
  }

  console.log(`\nXong: ${okCount}/${units.length} phần đồng bộ thành công.`);
  if (failures.length > 0) {
    console.log("Các phần cần xem lại:");
    for (const failure of failures) {
      console.log(`  - ${failure}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
