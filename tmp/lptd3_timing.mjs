// Dong bo moc thoi gian transcript<->audio cho 40 unit LPTD 3 tren prod.
// Chay:  node tmp/lptd3_timing.mjs
import { execSync } from "node:child_process";
import fs from "node:fs";
const env = fs.readFileSync("E:/web_ielts/.env", "utf8");
const get = (k) => env.split(/\r?\n/).find((l) => l.trim().startsWith(k + "="))
  ?.slice(k.length + 1).trim().replace(/^["']|["']$/g, "");
execSync("npx tsx scripts/backfill-transcript-timing.ts", {
  cwd: "E:/web_ielts",
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: get("DATABASE_URL_PROD"), GROQ_API_KEY: get("GROQ_API_KEY") }
});
