import { NextResponse } from "next/server";
import { warmUpDatabase } from "@/lib/db-warmup";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import {
  buildReminderEmail,
  findDueReminders,
  groupRemindersByStudent,
  type ReminderCandidate,
} from "@/lib/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Đủ chỗ cho vài lần chờ DB Neon tỉnh dậy (xem warmUpDatabase).
export const maxDuration = 60;

// Nhắc trước 24 giờ. Cron chạy 12h trưa VN mỗi ngày (0 5 * * * UTC) nên bài giao
// sau 12h trưa mà hạn trước 12h trưa hôm sau sẽ không kịp nhắc — hạn chế đã biết
// của việc chỉ chạy 1 cron/ngày (hạn mức Vercel Hobby).
const WINDOW_HOURS = 24;
const PENDING_STATUSES = ["assigned", "in_progress"];

function resolveAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configured) {
    return configured;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;

  // Mặc định đóng: chưa đặt CRON_SECRET thì không ai gọi được, kể cả Vercel.
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isEmailConfigured()) {
    console.warn("[cron/reminders] Bỏ qua: chưa cấu hình GMAIL_USER / GMAIL_APP_PASSWORD.");
    return NextResponse.json({ skipped: "email_not_configured" });
  }

  // Đánh thức Neon trước: 12h trưa gần như không có ai vào web nên compute đang ngủ,
  // truy vấn đầu tiên hay chết vì chưa kết nối kịp.
  try {
    const attempts = await warmUpDatabase(() => prisma.$queryRaw`SELECT 1`);

    if (attempts > 1) {
      console.warn(`[cron/reminders] DB tỉnh sau ${attempts} lần thử.`);
    }
  } catch (error) {
    console.error("[cron/reminders] Không kết nối được database:", error);
    return NextResponse.json({ error: "database_unreachable" }, { status: 503 });
  }

  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_HOURS * 60 * 60 * 1000);

  const rows = await prisma.assignmentRecipient.findMany({
    where: {
      reminderSentAt: null,
      status: { in: PENDING_STATUSES },
      assignment: { deadline: { gt: now, lte: until } },
    },
    select: {
      id: true,
      status: true,
      reminderSentAt: true,
      student: { select: { email: true, displayName: true } },
      assignment: {
        select: {
          title: true,
          deadline: true,
          units: { select: { assignableUnit: { select: { skill: true } } } },
        },
      },
    },
  });

  const candidates: ReminderCandidate[] = rows.map((row) => ({
    recipientId: row.id,
    studentEmail: row.student.email,
    studentName: row.student.displayName,
    assignmentTitle: row.assignment.title,
    skills: row.assignment.units.map((unit) => unit.assignableUnit.skill),
    deadline: row.assignment.deadline,
    status: row.status,
    reminderSentAt: row.reminderSentAt,
  }));

  const reminders = groupRemindersByStudent(findDueReminders(candidates, now, WINDOW_HOURS));
  const appUrl = resolveAppUrl();

  // allSettled: một em gửi lỗi thì các em còn lại vẫn nhận được mail.
  const results = await Promise.allSettled(
    reminders.map(async (reminder) => {
      const { subject, html, text } = buildReminderEmail(reminder, appUrl, now);

      await sendEmail(reminder.email, subject, html, text);

      // Chỉ đánh dấu SAU khi gửi xong — gửi lỗi thì trưa mai thử lại.
      await prisma.assignmentRecipient.updateMany({
        where: { id: { in: reminder.recipientIds } },
        data: { reminderSentAt: new Date() },
      });
    })
  );

  let sent = 0;

  for (const result of results) {
    if (result.status === "fulfilled") {
      sent += 1;
    } else {
      console.error("[cron/reminders] Gửi mail thất bại:", result.reason);
    }
  }

  return NextResponse.json({
    checked: candidates.length,
    students: reminders.length,
    sent,
    failed: results.length - sent,
  });
}
