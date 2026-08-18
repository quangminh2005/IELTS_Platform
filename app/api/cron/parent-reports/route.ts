import { NextResponse } from "next/server";
import { resolveAppUrl } from "@/lib/app-url";
import { warmUpDatabase } from "@/lib/db-warmup";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { buildParentSummary, shouldSendReport } from "@/lib/parent-report";
import { buildParentReportEmail } from "@/lib/parent-report-email";
import { loadParentReportItems } from "@/lib/parent-report-query";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Đủ chỗ cho vài lần chờ DB Neon tỉnh dậy (xem warmUpDatabase).
export const maxDuration = 60;

// Chạy 12h trưa Chủ nhật giờ VN (0 5 * * 0 UTC). Vercel có thể gọi lặp, nên phải
// dựa vào parentReportSentAt để không gửi hai lần trong cùng một tuần.
const RESEND_GUARD_MS = 6 * 24 * 60 * 60 * 1000;

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;

  // Mặc định đóng: chưa đặt CRON_SECRET thì không ai gọi được, kể cả Vercel.
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json({ skipped: "Chưa cấu hình email." });
  }

  // Giờ vắng Neon cho compute ngủ — truy vấn đầu tiên hay lỗi. Đánh thức trước.
  await warmUpDatabase(() => prisma.$queryRaw`SELECT 1`);

  const now = new Date();
  const guard = new Date(now.getTime() - RESEND_GUARD_MS);

  const students = await prisma.studentProfile.findMany({
    where: {
      parentEmail: { not: null },
      parentToken: { not: null },
      OR: [{ parentReportSentAt: null }, { parentReportSentAt: { lt: guard } }]
    },
    select: {
      id: true,
      displayName: true,
      parentEmail: true,
      parentName: true,
      parentToken: true
    }
  });

  const appUrl = resolveAppUrl();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const student of students) {
    if (!student.parentEmail || !student.parentToken) {
      skipped += 1;
      continue;
    }

    try {
      const items = await loadParentReportItems(student.id);
      const summary = buildParentSummary(items, now, "week");

      // Tuần không học gì và cũng không nợ bài -> không gửi mail rỗng.
      if (!shouldSendReport(summary)) {
        skipped += 1;
        continue;
      }

      const mail = buildParentReportEmail({
        studentName: student.displayName,
        parentName: student.parentName,
        summary,
        link: `${appUrl}/ph/${student.parentToken}`
      });

      await sendEmail(student.parentEmail, mail.subject, mail.html, mail.text);

      // Chỉ ghi mốc SAU khi gửi thành công, để lần chạy sau còn thử lại.
      await prisma.studentProfile.update({
        where: { id: student.id },
        data: { parentReportSentAt: new Date() }
      });

      sent += 1;
    } catch (error) {
      // Một học viên lỗi không được làm hỏng cả lượt chạy.
      failed += 1;
      console.error(
        "[cron/parent-reports] Gửi thất bại cho học viên",
        student.id,
        String(error instanceof Error ? error.message : error)
      );
    }
  }

  return NextResponse.json({ sent, skipped, failed, total: students.length });
}
