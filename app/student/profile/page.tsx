import { redirect } from "next/navigation";
import { AttendanceCalendar } from "@/components/attendance-calendar";
import { MyProfileHero } from "@/components/my-profile-hero";
import { MascotCard, RankCard, StatGrid } from "@/components/profile-side-cards";
import { RankTierBadge } from "@/components/rank-tier-badge";
import { updateMyProfile } from "@/lib/actions/profile";
import { auth } from "@/lib/auth";
import { activeDayKeys } from "@/lib/activity-heatmap";
import { buildAttendanceMonthFromKeys } from "@/lib/attendance";
import { averageBandsBySkillAcrossAttempts, formatBand, SKILL_SHORT_LABELS } from "@/lib/band-score";
import { countsForStats } from "@/lib/practice";
import { prisma } from "@/lib/prisma";
import { resolveItem } from "@/lib/shop-catalog";
import { DEFAULT_COVER_KEY } from "@/lib/student-avatar";
import { VN_OFFSET_MS } from "@/lib/streak";
import { getDayStreak, loadActivityDays } from "@/lib/day-streak-data";
import { getLifetimeXp } from "@/lib/xp-rank-data";

export const dynamic = "force-dynamic";

// Đọc/kẹp tham số điều hướng lịch chuyên cần trên URL, dạng "?month=YYYY-MM".
// Tên tham số để tiếng Anh (month) cho khớp quy ước ĐANG CÓ của app/student/*
// (tab, skill, classId, page, q — toàn bộ đều là tên tiếng Anh dù chữ hiển thị
// tiếng Việt; không có route nào trong app/ dùng tên tham số tiếng Việt).
//
// Chặn tham số gõ tay bừa bãi: năm phải nằm trong khoảng hợp lý và tháng không
// được vượt quá tháng hiện tại (giờ Việt Nam) — sai định dạng hoặc ngoài
// khoảng thì coi như không truyền, quay về tháng hiện tại thay vì lỗi trang.
function resolveRequestedMonth(
  raw: string | undefined,
  currentYear: number,
  currentMonth: number
): { year: number; month: number } {
  const match = raw?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const inRange = year >= 2000 && year <= currentYear && month >= 1 && month <= 12;
    const notFuture = year < currentYear || month <= currentMonth;
    if (inRange && notFuture) {
      return { year, month };
    }
  }
  return { year: currentYear, month: currentMonth };
}

function formatMonthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// Cộng/trừ n tháng, tự cuốn qua năm.
function shiftMonth(year: number, month: number, delta: number) {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

export default async function StudentProfilePage({
  searchParams
}: {
  searchParams?: { month?: string };
}) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "student") {
    redirect("/login");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      avatarPreset: true,
      coverColor: true,
      coverImageUrl: true,
      equippedBackground: true,
      equippedFrame: true,
      equippedMascot: true,
      targetBand: true,
      createdAt: true,
      user: { select: { image: true } }
    }
  });

  if (!student) {
    redirect("/waiting");
  }

  // Các truy vấn dưới đây độc lập với nhau, chỉ phụ thuộc student.id đã có ở
  // trên — gộp Promise.all để chạy song song thay vì nối đuôi tuần tự.
  const [attempts, vocabWordCount, lifetimeXp, ownedItems] = await Promise.all([
    prisma.attempt.findMany({
      where: { studentId: student.id, submittedAt: { not: null }, ...countsForStats },
      select: {
        // Answer KHÔNG có cột skill — kỹ năng nằm ở phần bài (assignableUnit).
        // Mọi nơi gọi bandsBySkill đều phải tự ánh xạ như dưới đây.
        answers: {
          select: { isCorrect: true, assignableUnit: { select: { skill: true } } }
        }
      }
    }),
    prisma.vocabProgress.count({
      where: { studentId: student.id }
    }),
    // Hạng đấu = XP tích luỹ trọn đời (lib/xp-rank.ts).
    getLifetimeXp(student.id),
    // Nền/khung đã sở hữu — cho mục "đã mở khóa" trong bảng chỉnh sửa.
    prisma.studentItem.findMany({
      where: { studentId: student.id },
      select: { itemKey: true }
    })
  ]);

  // Band trung bình theo từng kỹ năng — quy đổi RIÊNG cho mỗi lần làm rồi mới lấy
  // trung bình, không gộp câu trả lời của nhiều lần làm lại (xem lib/band-score.ts).
  const bands = averageBandsBySkillAcrossAttempts(
    attempts.map((attempt) =>
      attempt.answers.map((answer) => ({
        isCorrect: answer.isCorrect,
        skill: answer.assignableUnit.skill
      }))
    )
  );

  // Cùng nguồn với trang chủ (mọi lượt nộp + ôn Sổ từ + ngày đã cứu bằng Xu).
  const { streak } = await getDayStreak(student.id);

  const now = new Date();
  const nowVN = new Date(now.getTime() + VN_OFFSET_MS);
  const currentYear = nowVN.getUTCFullYear();
  const currentMonth = nowVN.getUTCMonth() + 1;

  const requestedMonth = resolveRequestedMonth(searchParams?.month, currentYear, currentMonth);
  const isCurrentMonth =
    requestedMonth.year === currentYear && requestedMonth.month === currentMonth;

  const monthKey = formatMonthParam(requestedMonth.year, requestedMonth.month);
  // Cùng nguồn với chuỗi 🔥 (mọi lượt nộp + ôn Sổ từ). Trước 5/10/2026 lịch chỉ đếm
  // lượt countsForStats nên có ngày chuỗi vẫn tính mà ô lịch lại tắt.
  const monthActivity = await loadActivityDays(student.id, `${monthKey}-01`);
  const attendance = buildAttendanceMonthFromKeys({
    activeKeys: activeDayKeys(monthActivity).filter((key) => key.startsWith(`${monthKey}-`)),
    monthKey
  });

  const prevMonth = shiftMonth(requestedMonth.year, requestedMonth.month, -1);
  const prevMonthHref = `/student/profile?month=${formatMonthParam(prevMonth.year, prevMonth.month)}`;
  const nextMonth = shiftMonth(requestedMonth.year, requestedMonth.month, 1);
  // Không cho xem tháng "tương lai" — nút tới tháng biến mất khi đang ở tháng hiện tại.
  const nextMonthHref = isCurrentMonth
    ? null
    : `/student/profile?month=${formatMonthParam(nextMonth.year, nextMonth.month)}`;

  const joined = new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "numeric",
    year: "numeric"
  }).format(student.createdAt);

  const ownedKeys = ownedItems.map((row) => row.itemKey);
  const ownedOf = (category: "background" | "frame") =>
    ownedKeys.filter((key) => resolveItem(key)?.category === category);

  const bandText =
    bands.length > 0
      ? bands
          .map((band) => `${SKILL_SHORT_LABELS[band.skill] ?? band.skill} ${formatBand(band.band)}`)
          .join(" · ")
      : "Chưa có";

  // Bố cục 2 cột kiểu chin từ màn xl: trái = bìa + lịch, phải = hạng/thống kê/linh
  // vật. Màn nhỏ xếp một cột theo thứ tự bìa → thẻ phải → lịch: cột trái dùng
  // `contents` để bìa và lịch thành phần tử con trực tiếp của flex, xếp bằng order.
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
      <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-6">
        <section className="order-1 overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <MyProfileHero
            action={updateMyProfile}
            userImage={student.user?.image ?? null}
            ownedBackgroundKeys={ownedOf("background")}
            ownedFrameKeys={ownedOf("frame")}
            saved={{
              displayName: student.displayName,
              bio: student.bio ?? "",
              avatarUrl: student.avatarUrl,
              avatarPreset: student.avatarPreset,
              coverColor: student.coverColor ?? DEFAULT_COVER_KEY,
              coverImageUrl: student.coverImageUrl,
              equippedBackground: student.equippedBackground,
              equippedFrame: student.equippedFrame,
              targetBand: student.targetBand !== null ? String(student.targetBand) : ""
            }}
          />
          <div className="px-5 pb-5 pt-4 text-center">
            {/* Bio là chữ do học viên nhập — render text thuần, không bao giờ HTML. */}
            {student.bio ? (
              <p className="mx-auto max-w-prose whitespace-pre-line text-sm text-muted-foreground">
                {student.bio}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
              <span>Tham gia từ {joined}</span>
              <span aria-hidden="true">·</span>
              <RankTierBadge xp={lifetimeXp} />
              {student.targetBand !== null ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Mục tiêu {formatBand(student.targetBand)}</span>
                </>
              ) : null}
            </div>
          </div>
        </section>

        <div className="order-3">
          <AttendanceCalendar data={attendance} prevHref={prevMonthHref} nextHref={nextMonthHref} />
        </div>
      </div>

      <aside className="order-2 flex flex-col gap-4 xl:order-none">
        <RankCard xp={lifetimeXp} showXp />
        <StatGrid
          stats={[
            { label: "Bài đã nộp", value: String(attempts.length) },
            { label: "Từ vựng đã học", value: String(vocabWordCount) },
            { label: "Chuỗi ngày", value: `${streak.days} ngày` },
            { label: "Band trung bình", value: bandText }
          ]}
        />
        <MascotCard poseKey={student.equippedMascot} own />
      </aside>
    </div>
  );
}
