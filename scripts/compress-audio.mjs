// Nén lại audio Listening trên Vercel Blob: 128 kbps STEREO -> 64 kbps MONO.
//
// Vì sao: file gốc do giáo viên upload là stereo 128 kbps — với giọng nói thì
// kênh stereo hoàn toàn vô ích và 128 kbps là thừa. Đo thật: 1 part 6,5 phút =
// 6,2 MB; sau khi nén còn ~3,1 MB. Một đề 4 part giảm từ ~25 MB xuống ~12 MB,
// khác biệt rất rõ với học viên dùng 4G.
//
// An toàn:
// - KHÔNG xoá blob cũ. Chỉ upload file mới rồi trỏ AssignableUnit.audioUrl sang.
//   Muốn quay lại chỉ cần đổi URL về như cũ (blob cũ vẫn còn nguyên).
// - Bỏ qua file đã mono (chạy lại nhiều lần vô hại).
// - Đối chiếu thời lượng trước/sau; lệch quá 1 giây thì bỏ qua file đó, không ghi DB.
//
// Chạy:  node scripts/compress-audio.mjs [--limit N] [--dry-run]
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import { put } from "@vercel/blob";

const run = promisify(execFile);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.indexOf("--limit");
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;

const databaseUrl = process.env.DATABASE_URL_PROD ?? process.env.DATABASE_URL;
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

if (!blobToken) {
  console.error("Thiếu BLOB_READ_WRITE_TOKEN.");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

const TARGET_BITRATE = "64k";

// Đọc thông tin audio (kênh, bitrate, thời lượng) từ URL hoặc file.
async function probe(input) {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "a:0",
    "-show_entries", "stream=channels,bit_rate",
    "-show_entries", "format=duration,size",
    "-of", "default=noprint_wrappers=1",
    input
  ], { maxBuffer: 1024 * 1024 });

  const get = (key) => {
    const match = stdout.match(new RegExp(`^${key}=(.+)$`, "m"));
    return match ? match[1].trim() : null;
  };

  return {
    channels: Number(get("channels")),
    duration: Number(get("duration")),
    size: Number(get("size"))
  };
}

const workDir = mkdtempSync(join(tmpdir(), "ielts-audio-"));

const units = await prisma.assignableUnit.findMany({
  where: { audioUrl: { not: null } },
  select: { id: true, title: true, audioUrl: true },
  orderBy: { createdAt: "asc" }
});

console.log(`Tìm thấy ${units.length} phần có audio. Thư mục tạm: ${workDir}\n`);

let done = 0;
let skipped = 0;
let failed = 0;
let bytesBefore = 0;
let bytesAfter = 0;

for (const unit of units) {
  if (done >= limit) break;

  const label = `${unit.title}`.slice(0, 48).padEnd(48);

  let before;
  try {
    before = await probe(unit.audioUrl);
  } catch (error) {
    console.log(`${label} LỖI đọc file gốc: ${String(error.message).split("\n")[0]}`);
    failed += 1;
    continue;
  }

  if (before.channels === 1) {
    console.log(`${label} bỏ qua (đã mono)`);
    skipped += 1;
    continue;
  }

  const outPath = join(workDir, `${unit.id}.mp3`);

  try {
    await run("ffmpeg", [
      "-v", "error",
      "-i", unit.audioUrl,
      "-ac", "1",
      "-c:a", "libmp3lame",
      "-b:a", TARGET_BITRATE,
      "-map_metadata", "-1",
      "-y", outPath
    ], { maxBuffer: 8 * 1024 * 1024 });
  } catch (error) {
    console.log(`${label} LỖI nén: ${String(error.message).split("\n")[0]}`);
    failed += 1;
    continue;
  }

  const after = await probe(outPath);
  const drift = Math.abs(after.duration - before.duration);

  if (!Number.isFinite(drift) || drift > 1) {
    console.log(`${label} BỎ QUA: thời lượng lệch ${drift.toFixed(2)}s`);
    rmSync(outPath, { force: true });
    failed += 1;
    continue;
  }

  const newSize = statSync(outPath).size;
  const pct = Math.round((1 - newSize / before.size) * 100);

  if (dryRun) {
    console.log(
      `${label} ${(before.size / 1e6).toFixed(1)}MB -> ${(newSize / 1e6).toFixed(1)}MB (-${pct}%)  [dry-run]`
    );
    bytesBefore += before.size;
    bytesAfter += newSize;
    done += 1;
    rmSync(outPath, { force: true });
    continue;
  }

  // Giữ nguyên tên gốc (phần trước dấu gạch ngẫu nhiên của Blob) cho dễ nhận ra,
  // addRandomSuffix để không đè lên file cũ — file cũ phải còn để quay lại được.
  const originalName = decodeURIComponent(new URL(unit.audioUrl).pathname.slice(1));
  const baseName = originalName.replace(/-[A-Za-z0-9]{20,}\.mp3$/i, "").replace(/\.mp3$/i, "");

  let uploaded;
  try {
    uploaded = await put(`${baseName}-64k.mp3`, readFileSync(outPath), {
      access: "public",
      contentType: "audio/mpeg",
      addRandomSuffix: true,
      token: blobToken
    });
  } catch (error) {
    console.log(`${label} LỖI upload: ${String(error.message).split("\n")[0]}`);
    failed += 1;
    rmSync(outPath, { force: true });
    continue;
  }

  await prisma.assignableUnit.update({
    where: { id: unit.id },
    data: { audioUrl: uploaded.url }
  });

  console.log(
    `${label} ${(before.size / 1e6).toFixed(1)}MB -> ${(newSize / 1e6).toFixed(1)}MB (-${pct}%)  OK`
  );

  bytesBefore += before.size;
  bytesAfter += newSize;
  done += 1;
  rmSync(outPath, { force: true });
}

rmSync(workDir, { recursive: true, force: true });
await prisma.$disconnect();

console.log(
  `\nXong: ${done} file đã nén, ${skipped} bỏ qua, ${failed} lỗi.\n` +
    `Tổng: ${(bytesBefore / 1e6).toFixed(0)} MB -> ${(bytesAfter / 1e6).toFixed(0)} MB ` +
    `(giảm ${bytesBefore > 0 ? Math.round((1 - bytesAfter / bytesBefore) * 100) : 0}%).\n` +
    `Blob cũ KHÔNG bị xoá — dọn sau bằng scripts/blob-orphans.mjs khi đã chắc chắn.`
);
