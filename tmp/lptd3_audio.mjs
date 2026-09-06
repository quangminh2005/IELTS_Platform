// Tai 40 file MP3 cua "Listening Practice Through Dictation 3" len Vercel Blob,
// ghi ra tmp/lptd3_audio_urls.json (unit -> URL).
//
//   node tmp/lptd2_audio.mjs           -> chi kiem tra + bao cao (KHONG tai len)
//   node tmp/lptd2_audio.mjs --upload  -> tai len Blob
//
// KHONG nen lai: file goc ~130 kbps joint-stereo, do lech hai kenh ~ -91 dB
// (thuc chat da la mono). Nen lai 128k mono cho ra file TO HON ma con mat chat
// luong vi encode lossy hai lan — nghe chep chinh ta thi can ro tieng nhat.
import fs from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";

const SRC_DIR = "E:/Listening Practice Through Dictation 3/Audio + Transcipt";
const URL_MAP = "E:/web_ielts/tmp/lptd3_audio_urls.json";
const DO_UPLOAD = process.argv.includes("--upload");

const env = fs.readFileSync("E:/web_ielts/.env", "utf8");
const token = env
  .split(/\r?\n/)
  .find((l) => l.trim().startsWith("BLOB_READ_WRITE_TOKEN="))
  ?.slice("BLOB_READ_WRITE_TOKEN=".length)
  .trim()
  .replace(/^["']|["']$/g, "");
if (DO_UPLOAD && !token) throw new Error("Thiếu BLOB_READ_WRITE_TOKEN trong .env");

const files = new Map();
for (const name of fs.readdirSync(SRC_DIR)) {
  const m = /^Unit\s+(\d{1,2})\b/i.exec(name);
  if (m && name.toLowerCase().endsWith(".mp3")) files.set(Number(m[1]), path.join(SRC_DIR, name));
}
const missing = [];
for (let n = 1; n <= 40; n += 1) if (!files.has(n)) missing.push(n);
if (missing.length) throw new Error(`Thiếu audio cho unit: ${missing.join(", ")}`);

const urls = fs.existsSync(URL_MAP) ? JSON.parse(fs.readFileSync(URL_MAP, "utf8")) : {};
let total = 0;
let uploaded = 0;

for (let n = 1; n <= 40; n += 1) {
  const src = files.get(n);
  const size = fs.statSync(src).size;
  total += size;

  if (urls[n]) {
    console.log(`Unit ${String(n).padStart(2)}  ${(size / 1e6).toFixed(2)}MB  đã có URL`);
    continue;
  }
  if (!DO_UPLOAD) {
    console.log(`Unit ${String(n).padStart(2)}  ${(size / 1e6).toFixed(2)}MB  ${path.basename(src)}`);
    continue;
  }
  const blob = await put(
    `listening/lptd3/unit-${String(n).padStart(2, "0")}.mp3`,
    fs.readFileSync(src),
    { access: "public", token, addRandomSuffix: true, contentType: "audio/mpeg" }
  );
  urls[n] = blob.url;
  uploaded += 1;
  fs.writeFileSync(URL_MAP, JSON.stringify(urls, null, 1), "utf8");
  console.log(`Unit ${String(n).padStart(2)}  ${(size / 1e6).toFixed(2)}MB  -> đã tải lên`);
}

console.log(`\nTổng ${(total / 1e6).toFixed(1)}MB • ${Object.keys(urls).length}/40 unit có URL`
  + (DO_UPLOAD ? ` (lần này tải ${uploaded})` : " — chạy lại với --upload để đẩy lên Blob"));
