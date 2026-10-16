// Luồng "thầy gửi bản nâng cấp cho học viên" trên DB LOCAL (AI giả): thầy bấm AI chấm
// nháp → mở mục Bản nâng cấp → Gửi → học viên thấy ở trang Kết quả → thầy Thu hồi.
import { chromium } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
const [port, outDir] = process.argv.slice(2);
const env = fs.readFileSync("E:/web_ielts/.env", "utf8");
const url = env.match(/^DATABASE_URL="?([^"\r\n]+)"?/m)[1];
const secret = env.match(/^NEXTAUTH_SECRET="?([^"\r\n]+)"?/m)[1];
const { assignmentId, attemptId } = JSON.parse(fs.readFileSync("E:/web_ielts/tmp/_e2e-ai-improved.json", "utf8"));
const p = new PrismaClient({ datasources: { db: { url } } });
const a = await p.assignment.findUnique({ where: { id: assignmentId }, select: { teacher: { select: { userId: true, user: { select: { email: true } } } } } });
const st = await p.studentProfile.findFirst({ where: { email: "student@example.com" }, select: { userId: true, email: true } });
const tokenT = await encode({ secret, token: { sub: a.teacher.userId, id: a.teacher.userId, email: a.teacher.user.email, name: "Teacher", role: "teacher" } });
const tokenS = await encode({ secret, token: { sub: st.userId, id: st.userId, email: st.email, name: "Demo Student", role: "student" } });
const browser = await chromium.launch({ channel: "chrome" });
const errors = [];
async function ctxFor(token, viewport = { width: 1500, height: 1000 }) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addCookies([{ name: "next-auth.session-token", value: token, domain: "localhost", path: "/", httpOnly: true }]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page };
}
const shared = async () => (await p.answer.findFirst({ where: { attemptId }, select: { aiImprovedText: true } })).aiImprovedText;

// Thầy
let { ctx, page } = await ctxFor(tokenT);
const reviewUrl = `http://localhost:${port}/teacher/review/${attemptId}`;
await page.goto(reviewUrl, { waitUntil: "networkidle", timeout: 180000 });
await page.getByRole("button", { name: /AI chấm nháp/ }).click();
await page.locator("details", { hasText: "Bản nâng cấp của AI" }).first().waitFor({ timeout: 60000 });
let details = page.locator("details", { hasText: "Bản nâng cấp của AI" }).first();
await details.locator("summary").click();
await details.getByRole("button", { name: /Gửi bản nâng cấp cho học viên/ }).click();
await details.getByText("✓ Đã gửi cho học viên").waitFor({ timeout: 30000 });
await details.screenshot({ path: `${outDir}/6-teacher-sent.png` });
console.log("after send, DB has text:", Boolean(await shared()));
await ctx.close();

// Học viên
({ ctx, page } = await ctxFor(tokenS, { width: 390, height: 844 }));
await page.goto(`http://localhost:${port}/student/results/${attemptId}`, { waitUntil: "networkidle", timeout: 180000 });
const box = page.locator("details", { hasText: "Bản nâng cấp thầy gửi" }).first();
console.log("student sees block:", await box.count());
await box.locator("summary").click();
await page.waitForTimeout(400);
await box.screenshot({ path: `${outDir}/7-student-received.png` });
console.log("student no h-scroll:", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
await ctx.close();

// Thầy thu hồi
({ ctx, page } = await ctxFor(tokenT));
await page.goto(reviewUrl, { waitUntil: "networkidle" });
details = page.locator("details", { hasText: "Bản nâng cấp của AI" }).first();
await details.locator("summary").click();
await details.getByRole("button", { name: "Thu hồi" }).click();
await details.getByRole("button", { name: /Gửi bản nâng cấp cho học viên/ }).waitFor({ timeout: 30000 });
console.log("after revoke, DB has text:", Boolean(await shared()));
await ctx.close();
console.log(errors.length ? errors.join("\n") : "no page errors");
await browser.close();
await p.$disconnect();
