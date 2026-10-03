import Link from "next/link";
import { requireTeacherPage } from "@/lib/teacher-page";
import { prisma } from "@/lib/prisma";
import { getClassRanking } from "@/lib/class-ranking";
import { ClassRankingBoard } from "@/components/class-ranking-board";
import { MonthlyRecapBoard, formatXp } from "@/components/monthly-recap-board";
import { getMonthlyRecap } from "@/lib/monthly-recap-data";
import {
  monthKeyOf,
  monthName,
  monthNumberLabel,
  recentMonthKeys,
  resolveMonthKey
} from "@/lib/monthly-recap";

type TeacherRankingPageProps = {
  searchParams?: {
    classId?: string;
    view?: string;
    month?: string;
  };
};

// Tháng hiện tại + 6 tháng trước.
const RECAP_MONTH_OPTIONS = 7;

function RankingTabs({ active }: { active: "class" | "month" }) {
  const tabClass = (isActive: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-semibold transition ${
      isActive ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <nav className="inline-flex rounded-xl border border-border bg-border/30 p-1 dark:bg-border/20">
      <Link href="/teacher/ranking" className={tabClass(active === "class")}>
        Theo lớp
      </Link>
      <Link href="/teacher/ranking?view=month" className={tabClass(active === "month")}>
        Tổng kết tháng
      </Link>
    </nav>
  );
}

// Tổng kết tháng toàn trường — cùng số liệu học viên thấy trong popup đầu tháng,
// nhưng hiện đủ danh sách (không cắt ở Top 10) để thầy khen thưởng.
async function MonthlyRecapView({ month }: { month?: string }) {
  const now = new Date();
  const latest = monthKeyOf(now);
  const monthKey = resolveMonthKey(month, latest, RECAP_MONTH_OPTIONS);
  const recap = await getMonthlyRecap(monthKey, now);
  const isCurrent = monthKey === latest;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Bảng xếp hạng toàn trường</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Tổng kết tháng {monthName(monthKey)}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Cả trường đã cày{" "}
            <span className="font-semibold text-foreground">{formatXp(recap.totalXp)} XP</span> cùng{" "}
            <span className="font-semibold text-foreground">{recap.participantCount}</span> học viên trong tháng{" "}
            {monthNumberLabel(monthKey)}.
            {isCurrent ? " Tháng đang diễn ra nên số liệu còn thay đổi." : ""} Học viên thấy Top 10 của tháng
            trước trong popup 7 ngày đầu tháng.
          </p>
          <div className="mt-4">
            <RankingTabs active="month" />
          </div>
        </div>

        <form method="get" className="flex shrink-0 items-end gap-2">
          <input type="hidden" name="view" value="month" />
          <label className="block text-sm font-medium">
            <span className="mb-2 block">Chọn tháng</span>
            <select
              name="month"
              defaultValue={monthKey}
              className="w-56 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
            >
              {recentMonthKeys(latest, RECAP_MONTH_OPTIONS).map((key) => (
                <option key={key} value={key}>
                  Tháng {monthName(key)} · {monthNumberLabel(key)}
                  {key === latest ? " (đang diễn ra)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
          >
            Xem
          </button>
        </form>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <MonthlyRecapBoard
          eyebrow={`XP · tháng ${monthNumberLabel(monthKey)}`}
          title="Top XP tháng"
          icon="👑"
          entries={recap.xpBoard}
          metric="xp"
          profileLinkTarget="teacher"
          emptyText="Tháng này chưa học viên nào có XP."
        />
        <MonthlyRecapBoard
          eyebrow={`Số ngày học · tháng ${monthNumberLabel(monthKey)}`}
          title="Chăm nhất tháng"
          icon="🔥"
          entries={recap.daysBoard}
          metric="days"
          profileLinkTarget="teacher"
          emptyText="Tháng này chưa học viên nào học."
        />
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        Cách tính XP: mỗi phần tự chấm đã nộp 10 XP + tối đa 10 XP theo % đúng; mỗi phần Viết/Nói chấm tay có
        bài làm 20 XP; ôn 2 thẻ Sổ từ = 1 XP (tối đa 15 XP/ngày); lượt tự luyện thứ 2 trở đi được nửa XP. Hệ
        số nằm ở lib/monthly-xp.ts.
      </p>
    </div>
  );
}

export default async function TeacherRankingPage({ searchParams }: TeacherRankingPageProps) {
  const teacher = await requireTeacherPage();

  if (searchParams?.view === "month") {
    return <MonthlyRecapView month={searchParams.month} />;
  }

  const classes = await prisma.class.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true }
  });

  if (classes.length === 0) {
    return (
      <div className="space-y-8">
        <header>
          <p className="text-sm font-semibold text-primary">Bảng xếp hạng lớp</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Xếp hạng</h2>
          <div className="mt-4">
            <RankingTabs active="class" />
          </div>
        </header>
        <div className="rounded-xl border border-border bg-card px-5 py-12 text-center shadow-card">
          <p className="text-sm font-medium">Chưa có lớp học nào</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tạo lớp và thêm học viên để xem bảng xếp hạng.
          </p>
          <Link
            href="/teacher/classes"
            className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
          >
            Tới trang Lớp học
          </Link>
        </div>
      </div>
    );
  }

  // Chỉ chọn trong danh sách đã lọc theo teacherId, nên id lạ hoặc lớp của giáo
  // viên khác đều rơi về lớp đầu tiên — không có đường xem lớp người khác.
  const selectedClass =
    classes.find((classItem) => classItem.id === searchParams?.classId) ?? classes[0];

  const rankedStudents = await getClassRanking(selectedClass.id);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Bảng xếp hạng lớp</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Xếp hạng</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Đây là bảng xếp hạng mà học viên lớp{" "}
            <span className="font-medium text-foreground">{selectedClass.name}</span> đang nhìn thấy.
            Điểm xếp hạng kết hợp điểm trung bình, mức độ hoàn thành và hoạt động gần đây.
          </p>
          <div className="mt-4">
            <RankingTabs active="class" />
          </div>
        </div>

        <form method="get" className="flex shrink-0 items-end gap-2">
          <label className="block text-sm font-medium">
            <span className="mb-2 block">Chọn lớp</span>
            <select
              name="classId"
              defaultValue={selectedClass.id}
              className="w-56 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
            >
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
          >
            Xem
          </button>
        </form>
      </header>

      <ClassRankingBoard students={rankedStudents} profileLinkTarget="teacher" />
    </div>
  );
}
