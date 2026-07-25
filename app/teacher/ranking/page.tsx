import Link from "next/link";
import { requireTeacherPage } from "@/lib/teacher-page";
import { prisma } from "@/lib/prisma";
import { getClassRanking } from "@/lib/class-ranking";
import { ClassRankingBoard } from "@/components/class-ranking-board";

type TeacherRankingPageProps = {
  searchParams?: {
    classId?: string;
  };
};

export default async function TeacherRankingPage({ searchParams }: TeacherRankingPageProps) {
  const teacher = await requireTeacherPage();

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

      <ClassRankingBoard students={rankedStudents} />
    </div>
  );
}
