import Link from "next/link";
import { redirect } from "next/navigation";
import { ClassRankingBoard } from "@/components/class-ranking-board";
import { LeaderboardBoard } from "@/components/leaderboard/leaderboard-board";
import { RankingSwitcher } from "@/components/leaderboard/ranking-switcher";
import { StreakBoardHeader } from "@/components/leaderboard/streak-board-header";
import { XpBoardHeader } from "@/components/leaderboard/xp-board-header";
import { auth } from "@/lib/auth";
import { getClassRanking } from "@/lib/class-ranking";
import {
  formatCountdown,
  monthEndsIn,
  rankingHref,
  rankingMonthNav,
  resolveRankingParams,
  streakBoardEntries,
  xpBoardEntries,
  type BoardPerson
} from "@/lib/leaderboard";
import { classMemberIds, getStreakBoard } from "@/lib/leaderboard-data";
import { monthKeyOf } from "@/lib/monthly-recap";
import { getMonthlyRecap } from "@/lib/monthly-recap-data";
import { prisma } from "@/lib/prisma";
import { getLifetimeXpMap } from "@/lib/xp-rank-data";

export const dynamic = "force-dynamic";

const DESCRIPTIONS = {
  xp: "XP cộng từ mọi lần nộp bài và ôn thẻ trong tháng — bảng làm mới vài phút một lần.",
  streak: "Số ngày học liên tiếp tính tới hôm nay. Hôm nay chưa học vẫn chưa mất chuỗi.",
  class: "Điểm xếp hạng kết hợp điểm trung bình, mức độ hoàn thành và hoạt động gần đây — chỉ trong lớp."
} as const;

function NoClass() {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-12 text-center shadow-card">
      <p className="text-sm font-medium">Bạn chưa thuộc lớp nào</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Chọn “Toàn trường” để so tài với cả trường, hoặc chờ thầy thêm bạn vào lớp.
      </p>
    </div>
  );
}

// Bảng xếp hạng kiểu chin (Mạng xã hội Đợt 1): Học Bá (XP tháng) · Chuỗi 🔥 · Điểm lớp.
export default async function StudentRankingPage({
  searchParams
}: {
  searchParams?: { board?: string; scope?: string; classId?: string; month?: string };
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
      avatarUrl: true,
      avatarPreset: true,
      equippedFrame: true,
      user: { select: { image: true } }
    }
  });

  if (!student) {
    redirect("/waiting");
  }

  const memberships = await prisma.classStudent.findMany({
    where: { studentId: student.id },
    orderBy: { joinedAt: "desc" },
    select: { class: { select: { id: true, name: true } } }
  });
  const classes = memberships.map((membership) => membership.class);

  const now = new Date();
  const latestMonth = monthKeyOf(now);
  const context = { latestMonth, defaultClassId: classes[0]?.id ?? null };
  const params = resolveRankingParams(searchParams, {
    classIds: classes.map((classItem) => classItem.id),
    latestMonth
  });
  const selectedClass = classes.find((classItem) => classItem.id === params.classId) ?? null;

  const me: BoardPerson = {
    studentId: student.id,
    displayName: student.displayName,
    avatarUrl: student.avatarUrl,
    avatarPreset: student.avatarPreset,
    userImage: student.user?.image ?? null,
    equippedFrame: student.equippedFrame
  };

  let body: JSX.Element;

  if (params.board === "class") {
    body = selectedClass ? (
      <ClassRankingBoard
        students={await getClassRanking(selectedClass.id)}
        highlightStudentId={student.id}
        profileLinkTarget="classmate"
      />
    ) : (
      <NoClass />
    );
  } else if (params.scope === "class" && !selectedClass) {
    body = <NoClass />;
  } else {
    const members = params.scope === "class" && selectedClass ? await classMemberIds(selectedClass.id) : null;
    const where = members && selectedClass ? `Lớp ${selectedClass.name}` : "Cả trường";

    if (params.board === "xp") {
      const recap = await getMonthlyRecap(params.monthKey, now);
      const lifetimeXp = await getLifetimeXpMap(recap.xpBoard.map((entry) => entry.studentId));
      const nav = rankingMonthNav(params.monthKey, latestMonth);

      body = (
        <>
          <XpBoardHeader
            monthKey={params.monthKey}
            countdownText={params.monthKey === latestMonth ? formatCountdown(monthEndsIn(now)) : null}
            prevHref={nav.prev ? rankingHref({ ...params, monthKey: nav.prev }, context) : null}
            nextHref={nav.next ? rankingHref({ ...params, monthKey: nav.next }, context) : null}
          />
          <LeaderboardBoard
            entries={xpBoardEntries(recap.xpBoard, members, lifetimeXp)}
            highlightStudentId={student.id}
            linkTarget="student"
            emptyText={`${where} chưa ai có XP tháng này.`}
            self={{ person: me, missingText: "chưa có XP tháng này" }}
          />
        </>
      );
    } else {
      const rows = await getStreakBoard(now);
      const myDays = rows.find((row) => row.studentId === student.id)?.days ?? 0;

      body = (
        <>
          <StreakBoardHeader myDays={myDays} />
          <LeaderboardBoard
            entries={streakBoardEntries(rows, members)}
            highlightStudentId={student.id}
            linkTarget="student"
            emptyText={`${where} chưa ai giữ được chuỗi — học hôm nay để nhóm lửa!`}
            self={{ person: me, missingText: "chưa có chuỗi" }}
          />
        </>
      );
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Bảng xếp hạng</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Xếp hạng</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{DESCRIPTIONS[params.board]}</p>
        <Link href="/student/ranks" className="mt-2 inline-block text-sm font-semibold text-primary hover:underline">
          Xem hệ thống hạng đấu →
        </Link>
      </header>

      <div className="mx-auto max-w-3xl space-y-4">
        <RankingSwitcher params={params} classes={classes} context={context} />
        {body}
      </div>
    </div>
  );
}
