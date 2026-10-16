// Bấm "Nhờ AI chấm" (chế độ giả AI_GRADING_FAKE=1) rồi chụp tab Bản nâng cấp + chip lọc lỗi.
import { chromium } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
const [port, outDir] = process.argv.slice(2);
const env = fs.readFileSync("E:/web_ielts/.env", "utf8");
const url = env.match(/^DATABASE_URL="?([^"\r\n]+)"?/m)[1];
const secret = env.match(/^NEXTAUTH_SECRET="?([^"\r\n]+)"?/m)[1];
const { attemptId } = JSON.parse(fs.readFileSync("E:/web_ielts/tmp/_e2e-ai-improved.json", "utf8"));
const p = new PrismaClient({ datasources: { db: { url } } });
const st = await p.studentProfile.findFirst({ where: { email: "student@example.com" }, select: { userId: true, email: true } });
await p.$disconnect();
const token = await encode({ secret, token: { sub: st.userId, id: st.userId, email: st.email, name: "Demo Student", role: "student" } });
const browser = await chromium.launch({ channel: "chrome" });
const errors = [];
async function open(viewport, name) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addCookies([{ name: "next-auth.session-token", value: token, domain: "localhost", path: "/", httpOnly: true }]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${name} console: ${m.text().slice(0, 200)}`); });
  await page.goto(`http://localhost:${port}/student/results/${attemptId}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);
  return { ctx, page };
}
let { ctx, page } = await open({ width: 1500, height: 1000 }, "desktop");
const ask = page.getByRole("button", { name: /Nhờ AI chấm bài này/ });
if (await ask.count()) {
  await ask.click();
  await page.waitForTimeout(6000);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
}
const section = page.locator("section", { hasText: "Nhận xét AI" }).first();
await section.scrollIntoViewIfNeeded();
await section.screenshot({ path: `${outDir}/1-errors.png` });
const chip = section.getByRole("button", { name: /Ngữ pháp \(GRA\)/ });
console.log("chips:", await section.locator("button").allInnerTexts());
if (await chip.count()) { await chip.click(); await page.waitForTimeout(300); await section.screenshot({ path: `${outDir}/2-filter-gra.png` }); }
await section.getByRole("tab", { name: /Bản nâng cấp/ }).click();
await page.waitForTimeout(400);
await section.screenshot({ path: `${outDir}/3-improved.png` });
await ctx.close();
({ ctx, page } = await open({ width: 390, height: 844 }, "mobile"));
const sec2 = page.locator("section", { hasText: "Nhận xét AI" }).first();
await sec2.getByRole("tab", { name: /Bản nâng cấp/ }).click();
await page.waitForTimeout(400);
await sec2.screenshot({ path: `${outDir}/4-mobile-improved.png` });
console.log("scrollWidth", await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]));
await ctx.close();
console.log(errors.length ? errors.join("\n") : "no errors");
await browser.close();
