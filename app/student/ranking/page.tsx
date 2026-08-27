import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClassRanking } from "@/lib/class-ranking";
import { ClassRankingBoard } from "@/components/class-ranking-board";

export default async function StudentRankingPage() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "student") {
    redirect("/login");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true }
  });

  if (!student) {
    redirect("/waiting");
  }

  const membership = await prisma.classStudent.findFirst({
    where: { studentId: student.id },
    orderBy: { joinedAt: "desc" },
    include: {
      class: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  if (!membership) {
    return (
      <div className="space-y-8">
        <header>
          <p className="text-sm font-semibold text-primary">Bảng xếp hạng lớp</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Xếp hạng</h2>
        </header>
        <div className="rounded-xl border border-border bg-card px-5 py-12 text-center shadow-card">
          <p className="text-sm font-medium">Bạn chưa thuộc lớp nào</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tham gia một lớp để so sánh tiến độ với các bạn cùng lớp.
          </p>
        </div>
      </div>
    );
  }

  const rankedStudents = await getClassRanking(membership.classId);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold text-primary">Bảng xếp hạng lớp</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Xếp hạng</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          So sánh tiến độ trong lớp <span className="font-medium text-foreground">{membership.class.name}</span>.
          Điểm xếp hạng kết hợp điểm trung bình, mức độ hoàn thành và hoạt động gần đây.
        </p>
      </header>

      <ClassRankingBoard
        students={rankedStudents}
        highlightStudentId={student.id}
        linkToProfiles
      />
    </div>
  );
}
