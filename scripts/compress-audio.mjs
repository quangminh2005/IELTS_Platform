// Nén lại audio Listening trên Vercel Blob cho nhẹ đi.
//
// Vì sao: toàn bộ 88 file giáo viên upload đều là stereo, 20 file ở 320 kbps.
// Với giọng nói thì đó là lãng phí thuần tuý — và chính nó đã làm store Blob
// vượt hạn mức 10 GB/tháng và bị khoá một lần (học viên mất audio).
//
// QUY TẮC: file TRÊN 128 kbps thì hạ về 128 kbps; từ 128 kbps trở xuống thì để
// nguyên, không đụng vào. Giáo viên chốt mức này sau khi nghe thử mẫu 30 giây.
// Thực tế chỉ nhóm 320 kbps (20 file, 309 MB) bị đụng tới: 688 MB -> ~503 MB.
//
// MONO CÓ MẤT TIẾNG KHÔNG? Không. File mono được mọi trình duyệt/điện thoại
// nhân đôi ra cả hai tai, nghe cân giữa. Và `-ac 1` của ffmpeg là TRỘN hai kênh
// (L+R)/2 chứ không vứt bỏ kênh phải. Đo trên 4 file: phần khác biệt giữa hai
// kênh thấp hơn bản trộn 40-61 dB ở 3 file (tức hai kênh giống hệt nhau — stereo
// chỉ là cái vỏ), riêng 1 file là 13 dB (có chút không gian stereo thật).
//
// Dù vậy script vẫn TỰ ĐO TỪNG FILE thay vì tin vào mẫu 4 file đó: file nào có
// khác biệt hai kênh quá gần mức tín hiệu thì giữ nguyên stereo, chỉ hạ bitrate.
//
// An toàn:
// - KHÔNG xoá blob cũ. Chỉ upload file mới rồi trỏ AssignableUnit.audioUrl sang.
//   Muốn quay lại chỉ cần đổi URL về như cũ (blob cũ vẫn còn nguyên).
// - Bỏ qua file đã mono (chạy lại nhiều lần vô hại).
// - Đối chiếu thời lượng trước/sau; lệch quá 1 giây thì bỏ qua file đó, không ghi DB.
//
// Chạy:  node scripts/compress-audio.mjs [--limit N] [--dry-run]
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
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
// Lọc theo một mẩu trong URL audio — để chạy lại đúng một file mà không phải
// đợi hết cả kho.
const onlyArg = args.indexOf("--only");
const only = onlyArg >= 0 ? args[onlyArg + 1] : null;
// Thư mục chứa file gốc trên máy. Có bản gốc thì KHÔNG tải từ Blob nữa — băng
// thông Blob là thứ đã làm store bị khoá một lần rồi (10 GB/tháng gói Hobby).
const localArg = args.indexOf("--local-dir");
const localDir = localArg >= 0 ? args[localArg + 1] : null;

const databaseUrl = process.env.DATABASE_URL_PROD ?? process.env.DATABASE_URL;
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

if (!blobToken) {
  console.error("Thiếu BLOB_READ_WRITE_TOKEN.");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

// Quy tắc do giáo viên chốt: file trên 128 kbps thì hạ về 128, từ 128 trở xuống
// thì để yên. Đây là bài thi — nghe rõ quan trọng hơn tiết kiệm băng thông.
const TARGET_BITRATE = "128k";
// Ngưỡng "coi như đã ở 128 kbps". File 128 kbps thật đo ra 128010–128041 bps chứ
// không tròn 128000, nên phải có dung sai, không thì chúng lọt qua và bị nén lại
// một cách vô nghĩa.
const SKIP_ABOVE_BPS = 128_000 * 1.05;
// Phần khác biệt (L−R) phải thấp hơn bản trộn mono ít nhất ngần này thì mới coi
// là "stereo giả" (hai kênh y hệt nhau) và cho phép gộp về mono. 20 dB = biên độ
// chênh lệch chỉ còn 1/10 tín hiệu — tai người không nhận ra khi nó biến mất.
const MONO_SAFE_MARGIN_DB = 20;

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
    size: Number(get("size")),
    bitRate: Number(get("bit_rate"))
  };
}

// Có đáng nén không? Chỉ khi file đang ở TRÊN 128 kbps. Kiểm tra này chạy trên
// header đọc qua mạng (vài chục KB) để loại sớm, trước khi tải trọn file —
// không thì mỗi file bị loại là vài MB băng thông Blob đổ đi vô ích.
function worthReencoding({ bitRate }) {
  return Number.isFinite(bitRate) && bitRate > SKIP_ABOVE_BPS;
}

// Mức âm lượng trung bình (dB) sau khi áp một bộ lọc pan. Trả về NaN nếu ffmpeg
// không in ra được (file hỏng) — chỗ gọi sẽ coi như "không đo được".
async function meanVolumeDb(file, panExpr) {
  // volumedetect in ra ở mức log "info" nên KHÔNG được đặt -v error ở đây.
  const { stderr } = await run(
    "ffmpeg",
    ["-i", file, "-af", `${panExpr},volumedetect`, "-f", "null", "-"],
    { maxBuffer: 8 * 1024 * 1024 }
  );
  const match = stderr.match(/mean_volume:\s*(-?[\d.]+) dB/);
  return match ? Number(match[1]) : NaN;
}

// Hai kênh có thật sự khác nhau không? So mức của bản trộn (L+R)/2 với mức của
// phần hiệu (L−R). Hiệu càng thấp so với bản trộn thì hai kênh càng giống nhau.
async function stereoDifferenceDb(file) {
  const [mono, diff] = await Promise.all([
    meanVolumeDb(file, "pan=mono|c0=0.5*c0+0.5*c1"),
    meanVolumeDb(file, "pan=mono|c0=c0-c1")
  ]);

  if (!Number.isFinite(mono) || !Number.isFinite(diff)) {
    return null;
  }

  return { mono, diff, marginDb: mono - diff };
}

async function download(url, dest) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
}

// Tên file gốc lúc upload = phần trước hậu tố ngẫu nhiên Blob thêm vào.
// Ví dụ "test20_part2-HZthNJgz9Gj9sEPTmPlbyLT0aDvMHW.mp3" -> "test20_part2".
function blobBaseName(audioUrl) {
  const path = decodeURIComponent(new URL(audioUrl).pathname.slice(1));
  return path.replace(/-[A-Za-z0-9]{20,}\.(mp3|m4a|wav|ogg)$/i, "").replace(/\.(mp3|m4a|wav|ogg)$/i, "");
}

// Chỉ mục file gốc trên máy, tra theo tên không đuôi (không phân biệt hoa thường).
function indexLocalFiles(dir) {
  const index = new Map();
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(mp3|m4a|wav|ogg)$/i.test(entry.name)) {
        index.set(entry.name.replace(/\.[^.]+$/, "").toLowerCase(), full);
      }
    }
  };
  walk(dir);
  return index;
}

const localIndex = localDir ? indexLocalFiles(localDir) : new Map();

if (localDir) {
  console.log(`Thư mục gốc trên máy: ${localDir} (${localIndex.size} file)`);
}

const workDir = mkdtempSync(join(tmpdir(), "ielts-audio-"));

const units = await prisma.assignableUnit.findMany({
  where: {
    audioUrl: only ? { contains: only } : { not: null }
  },
  select: { id: true, title: true, audioUrl: true },
  orderBy: { createdAt: "asc" }
});

console.log(`Tìm thấy ${units.length} phần có audio. Thư mục tạm: ${workDir}\n`);

let done = 0;
let skipped = 0;
let failed = 0;
let monoCount = 0;
let stereoCount = 0;
let bytesBefore = 0;
let bytesAfter = 0;
// Băng thông Blob đã tiêu để tải file gốc — thứ cần theo dõi sát.
let bytesDownloaded = 0;

for (const unit of units) {
  if (done >= limit) break;

  const label = `${unit.title}`.slice(0, 48).padEnd(48);

  const localSource = localIndex.get(blobBaseName(unit.audioUrl).toLowerCase()) ?? null;
  const downloadedPath = join(workDir, `${unit.id}-src.mp3`);
  const outPath = join(workDir, `${unit.id}.mp3`);
  // Có bản gốc trên máy thì dùng thẳng, KHÔNG tải từ Blob.
  const srcPath = localSource ?? downloadedPath;

  // Chỉ xoá file tạm. Bản gốc của giáo viên trên máy thì tuyệt đối không đụng vào.
  const cleanup = () => {
    if (!localSource) {
      rmSync(downloadedPath, { force: true });
    }
    rmSync(outPath, { force: true });
  };

  // Đọc thông số trước đã. Có bản gốc trên máy thì đọc từ đó; không thì đọc
  // header qua mạng (vài chục KB) — rẻ hơn nhiều so với tải trọn file rồi mới
  // phát hiện là không cần đụng tới.
  let before;
  try {
    before = await probe(localSource ?? unit.audioUrl);
  } catch (error) {
    console.log(`${label} LỖI đọc file gốc: ${String(error.message).split("\n")[0]}`);
    failed += 1;
    continue;
  }

  // Quy tắc: chỉ đụng vào file TRÊN 128 kbps. Đây cũng là thứ khiến chạy lại
  // nhiều lần vô hại — sau lần chạy đầu file đã ở 128 kbps nên bị bỏ qua.
  if (!worthReencoding(before)) {
    console.log(`${label} bỏ qua (đã ${Math.round(before.bitRate / 1000)} kbps)`);
    skipped += 1;
    continue;
  }

  if (!localSource) {
    // Tải về một lần rồi đo + nén tại chỗ. Nếu để ffmpeg đọc thẳng URL thì mỗi
    // lượt đo là một lượt tải lại cả file — ở đây cần 3 lượt đọc.
    try {
      await download(unit.audioUrl, downloadedPath);
    } catch (error) {
      console.log(`${label} LỖI tải: ${String(error.message).split("\n")[0]}`);
      failed += 1;
      continue;
    }
    bytesDownloaded += before.size;
  }

  // Đo xem gộp về mono có làm mất nội dung không. File vốn đã mono thì khỏi đo
  // (bộ lọc pan sẽ lỗi vì không có kênh c1).
  let stereoInfo = null;
  if (before.channels > 1) {
    try {
      stereoInfo = await stereoDifferenceDb(srcPath);
    } catch {
      stereoInfo = null;
    }
  }

  // Không đo được -> chọn phương án an toàn (giữ stereo), thà nhẹ ít còn hơn hỏng.
  const canGoMono =
    before.channels === 1 ||
    (stereoInfo !== null && stereoInfo.marginDb >= MONO_SAFE_MARGIN_DB);
  const mode = canGoMono ? "mono" : "stereo";
  // Bitrate đích như nhau cho cả hai: quy tắc là "trên 128 thì hạ về 128". Ở mức
  // này mono không nhẹ hơn stereo chút nào — nó chỉ dồn toàn bộ bit cho một kênh
  // nên nghe rõ hơn, và chỉ làm vậy khi đã đo được hai kênh giống hệt nhau.
  const bitrate = TARGET_BITRATE;
  const marginText = stereoInfo
    ? `L−R thấp hơn ${stereoInfo.marginDb.toFixed(0)}dB`
    : before.channels === 1
      ? "vốn đã mono"
      : "không đo được";

  try {
    await run("ffmpeg", [
      "-v", "error",
      "-i", srcPath,
      // KHÔNG dùng `-ac 1`: ffmpeg trộn stereo->mono bằng ma trận bảo toàn CÔNG
      // SUẤT (×0,707 mỗi kênh), mà ở đây hai kênh gần như giống hệt nhau nên
      // cộng lại thành +3 dB. Đo thật: bản gốc đỉnh -3,9 dB, sau `-ac 1` còn
      // -1,4 dB — file nào đỉnh sẵn gần 0 sẽ bị vỡ tiếng. `pan` dưới đây giữ
      // nguyên biên độ: đo lại chỉ lệch 0,5 dB so với bản gốc.
      ...(canGoMono ? ["-af", "pan=mono|c0=0.5*c0+0.5*c1"] : ["-ac", "2"]),
      "-c:a", "libmp3lame",
      "-b:a", bitrate,
      "-map_metadata", "-1",
      "-y", outPath
    ], { maxBuffer: 8 * 1024 * 1024 });
  } catch (error) {
    console.log(`${label} LỖI nén: ${String(error.message).split("\n")[0]}`);
    failed += 1;
    cleanup();
    continue;
  }

  const after = await probe(outPath);
  const drift = Math.abs(after.duration - before.duration);

  if (!Number.isFinite(drift) || drift > 1) {
    console.log(`${label} BỎ QUA: thời lượng lệch ${drift.toFixed(2)}s`);
    failed += 1;
    cleanup();
    continue;
  }

  const newSize = statSync(outPath).size;
  const pct = Math.round((1 - newSize / before.size) * 100);

  // Nén lại mà không nhẹ đi bao nhiêu thì đừng đổi: mỗi lần encode lại MP3 là
  // mất thêm một đời chất lượng, đổi lấy vài phần trăm dung lượng là lỗ.
  if (newSize > before.size * 0.9) {
    console.log(`${label} bỏ qua (chỉ giảm ${pct}%, không đáng encode lại)`);
    skipped += 1;
    cleanup();
    continue;
  }

  const sizeText =
    `${(before.size / 1e6).toFixed(1)}MB -> ${(newSize / 1e6).toFixed(1)}MB (-${pct}%)` +
    `  ${mode} ${bitrate} (${marginText})` +
    `  [${localSource ? "gốc trên máy" : "tải từ Blob"}]`;

  if (dryRun) {
    console.log(`${label} ${sizeText}  [dry-run]`);
    bytesBefore += before.size;
    bytesAfter += newSize;
    done += 1;
    if (canGoMono) monoCount += 1;
    else stereoCount += 1;
    cleanup();
    continue;
  }

  // Giữ nguyên tên gốc (phần trước dấu gạch ngẫu nhiên của Blob) cho dễ nhận ra,
  // addRandomSuffix để không đè lên file cũ — file cũ phải còn để quay lại được.
  const originalName = decodeURIComponent(new URL(unit.audioUrl).pathname.slice(1));
  const baseName = originalName.replace(/-[A-Za-z0-9]{20,}\.mp3$/i, "").replace(/\.mp3$/i, "");

  let uploaded;
  try {
    uploaded = await put(`${baseName}-${bitrate}.mp3`, readFileSync(outPath), {
      access: "public",
      contentType: "audio/mpeg",
      addRandomSuffix: true,
      token: blobToken
    });
  } catch (error) {
    console.log(`${label} LỖI upload: ${String(error.message).split("\n")[0]}`);
    failed += 1;
    cleanup();
    continue;
  }

  await prisma.assignableUnit.update({
    where: { id: unit.id },
    data: { audioUrl: uploaded.url }
  });

  console.log(`${label} ${sizeText}  OK`);

  bytesBefore += before.size;
  bytesAfter += newSize;
  done += 1;
  if (canGoMono) monoCount += 1;
  else stereoCount += 1;
  cleanup();
}

rmSync(workDir, { recursive: true, force: true });
await prisma.$disconnect();

console.log(
  `\nXong: ${done} file đã nén (${monoCount} gộp mono, ${stereoCount} giữ stereo), ` +
    `${skipped} bỏ qua, ${failed} lỗi.\n` +
    `Băng thông Blob đã tiêu để tải file gốc: ${(bytesDownloaded / 1e6).toFixed(0)} MB.\n` +
    `Tổng: ${(bytesBefore / 1e6).toFixed(0)} MB -> ${(bytesAfter / 1e6).toFixed(0)} MB ` +
    `(giảm ${bytesBefore > 0 ? Math.round((1 - bytesAfter / bytesBefore) * 100) : 0}%).\n` +
    `Blob cũ KHÔNG bị xoá — dọn sau bằng scripts/blob-orphans.mjs khi đã chắc chắn.`
);
