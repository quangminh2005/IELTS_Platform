// Quét file "mồ côi" trên Vercel Blob: liệt kê mọi blob thực tế trên store,
// đối chiếu với danh sách URL mà DB prod ĐANG tham chiếu, rồi báo cáo file
// KHÔNG còn được dùng + tổng dung lượng thu hồi được.
//
// MẶC ĐỊNH: chỉ BÁO CÁO, không xóa gì.
// Thêm cờ  --delete-confirmed  để thực sự xóa các file mồ côi (hỏi lại trước đó).
//
// Cần BLOB_READ_WRITE_TOKEN và DATABASE_URL_PROD (đọc từ shell hoặc từ .env).
//   node scripts/blob-orphans.mjs
//   node scripts/blob-orphans.mjs --delete-confirmed
//
// TRƯỚC ĐÂY chỗ này đọc danh sách tham chiếu từ scripts/blob-referenced.json —
// một ảnh chụp THỦ CÔNG, nên cứ mỗi lần DB đổi URL là nó lạc hậu ngay. Suýt gây
// hoạ thật: sau đợt nén audio, 20 URL mới không có trong ảnh chụp cũ nên script
// sẽ coi 20 file vừa upload là mồ côi và xoá sạch. Giờ luôn hỏi thẳng DB.

import { list, del } from "@vercel/blob";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// --- Nạp biến môi trường từ .env nếu shell chưa có ---
if (existsSync(join(root, ".env"))) {
  const envText = readFileSync(join(root, ".env"), "utf8");
  for (const key of ["BLOB_READ_WRITE_TOKEN", "DATABASE_URL_PROD", "DATABASE_URL"]) {
    if (process.env[key]) continue;
    const m = envText.match(new RegExp(`^\\s*${key}\\s*=\\s*["']?([^"'\\r\\n]+)`, "m"));
    if (m) process.env[key] = m[1].trim();
  }
}

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error(
    "\n❌ Thiếu BLOB_READ_WRITE_TOKEN.\n" +
      "   Lấy trên Vercel: Storage → (blob store) → .env.local / Connect, copy dòng\n" +
      "   BLOB_READ_WRITE_TOKEN=... rồi dán vào file .env ở gốc project.\n"
  );
  process.exit(1);
}

const doDelete = process.argv.includes("--delete-confirmed");

// --- Danh sách URL đang được dùng: hỏi thẳng DB prod, không tin ảnh chụp cũ ---
// Đã dò toàn bộ các cột text của schema: URL blob chỉ nằm ở đúng hai chỗ là
// AssignableUnit.audioUrl và AssignableUnit.metadataJson (ảnh chèn vào đề).
// Truy vấn dưới đây quét luôn cả hai bằng regex, nên thêm ảnh mới cũng không sót.
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_PROD ?? process.env.DATABASE_URL } }
});

const rows = await prisma.$queryRawUnsafe(`
  WITH src AS (
    SELECT "audioUrl" AS txt FROM "AssignableUnit"
    UNION ALL SELECT "metadataJson" FROM "AssignableUnit"
  )
  SELECT DISTINCT m[1] AS url
    FROM src, LATERAL regexp_matches(
      txt, 'https://[a-z0-9]+\\.public\\.blob\\.vercel-storage\\.com/[^"''\\s)\\\\]+', 'g'
    ) AS m
`);
await prisma.$disconnect();

const referenced = rows.map((r) => r.url);

if (referenced.length === 0) {
  console.error(
    "\n❌ DB không trả về URL blob nào. Dừng lại cho an toàn — nếu chạy tiếp thì\n" +
      "   MỌI file trên store đều bị coi là mồ côi. Kiểm tra DATABASE_URL_PROD.\n"
  );
  process.exit(1);
}

console.log(`Đang được DB tham chiếu: ${referenced.length} URL`);

const refUrls = new Set(referenced);
// so thêm bằng pathname đã giải mã, phòng khác biệt mã hoá %20 vs khoảng trắng
const decodePath = (u) => {
  try {
    return decodeURIComponent(new URL(u).pathname);
  } catch {
    return u;
  }
};
const refPaths = new Set(referenced.map(decodePath));

const isReferenced = (blob) =>
  refUrls.has(blob.url) || refPaths.has(decodePath(blob.url)) || refPaths.has("/" + blob.pathname);

// --- Liệt kê toàn bộ blob (phân trang) ---
const allBlobs = [];
let cursor;
do {
  const res = await list({ token, cursor, limit: 1000 });
  allBlobs.push(...res.blobs);
  cursor = res.hasMore ? res.cursor : undefined;
} while (cursor);

const orphans = allBlobs.filter((b) => !isReferenced(b));
const used = allBlobs.filter((b) => isReferenced(b));

const MB = (n) => (n / (1024 * 1024)).toFixed(2) + " MB";
const sum = (arr) => arr.reduce((s, b) => s + b.size, 0);

console.log("\n================ BÁO CÁO BLOB ================");
console.log(`Tổng số blob trên store : ${allBlobs.length}  (${MB(sum(allBlobs))})`);
console.log(`Đang được dùng          : ${used.length}  (${MB(sum(used))})`);
console.log(`MỒ CÔI (có thể xóa)     : ${orphans.length}  (${MB(sum(orphans))})`);
console.log("=============================================\n");

if (orphans.length === 0) {
  console.log("✅ Không có file mồ côi. Dung lượng đang dùng đều là file cần thiết.");
  console.log("   → Muốn giảm dung lượng thì phải NÉN audio (bước 2).\n");
  process.exit(0);
}

console.log("Danh sách file mồ côi (lớn → nhỏ):\n");
orphans
  .sort((a, b) => b.size - a.size)
  .forEach((b, i) => {
    console.log(
      `${String(i + 1).padStart(3)}. ${MB(b.size).padStart(10)}  ${b.pathname}` +
        `   (tải lên ${new Date(b.uploadedAt).toISOString().slice(0, 10)})`
    );
  });

if (!doDelete) {
  console.log(
    `\n👉 Đây mới chỉ là BÁO CÁO. Chưa xóa gì.\n` +
      `   Xem kỹ danh sách trên. Nếu chắc chắn muốn xóa toàn bộ ${orphans.length} file này,\n` +
      `   chạy lại:  node scripts/blob-orphans.mjs --delete-confirmed\n`
  );
  process.exit(0);
}

console.log(`\n🗑️  Đang xóa ${orphans.length} file mồ côi...`);
let deleted = 0;
for (const b of orphans) {
  await del(b.url, { token });
  deleted++;
  process.stdout.write(`\r   đã xóa ${deleted}/${orphans.length}`);
}
console.log(`\n✅ Xong. Đã thu hồi ${MB(sum(orphans))}.\n`);
