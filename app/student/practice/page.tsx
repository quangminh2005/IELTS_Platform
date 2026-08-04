import { redirect } from "next/navigation";
import { NoticeToast } from "@/components/notice-toast";
import { PracticeLibrary } from "@/components/practice-library";
import { auth } from "@/lib/auth";
import { onlyPracticeRecipient } from "@/lib/practice";
import {
  practiceProgressLabel,
  summarizePracticeAttempts,
  type PracticeMaterialItem
} from "@/lib/practice-library";
import { prisma } from "@/lib/prisma";

type StudentPracticePageProps = {
  searchParams?: {
    practiceMessage?: string;
    practiceStatus?: string;
  };
};

export default async function StudentPracticePage({ searchParams }: StudentPracticePageProps) {
  const practiceMessage = searchParams?.practiceMessage;
  const practiceStatus = searchParams?.practiceStatus === "success" ? "success" : "error";
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "student") {
    redirect("/login");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });

  if (!student) {
    redirect("/waiting");
  }

  // select (KHÔNG include): content/transcript/metadataJson của unit rất nặng.
  const [materials, attempts] = await Promise.all([
    prisma.material.findMany({
      where: { practiceOpen: true },
      orderBy: [{ skill: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        skill: true,
        sourceLabel: true,
        units: {
          orderBy: [{ unitNumber: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            title: true,
            _count: { select: { questions: true } }
          }
        }
      }
    }),
    prisma.attempt.findMany({
      where: {
        studentId: student.id,
        status: { in: ["submitted", "reviewed"] },
        assignmentRecipient: onlyPracticeRecipient
      },
      select: {
        score: true,
        assignmentRecipient: {
          select: { assignment: { select: { practiceScopeKey: true } } }
        }
      }
    })
  ]);

  // Gộp số lượt và điểm cao nhất theo từng đề (chỉ lượt luyện CẢ ĐỀ mới tính vào
  // điểm cao nhất — xem summarizePracticeAttempts).
  const progressByMaterial = summarizePracticeAttempts(
    attempts.map((attempt) => ({
      practiceScopeKey: attempt.assignmentRecipient.assignment.practiceScopeKey,
      score: attempt.score
    }))
  );

  // Đề chưa có phần nào (giáo viên bật "Cho tự luyện" trước khi thêm phần) không
  // có gì để bấm vào luyện — lọc bỏ ngay ở đây thay vì bày ra thứ mà bấm vào là
  // văng lỗi (startPractice cũng tự chặn units.length === 0, đây là lớp lọc UI
  // cho tình huống thường gặp).
  const items: PracticeMaterialItem[] = materials
    .filter((material) => material.units.length > 0)
    .map((material) => {
      const questionCount = material.units.reduce(
        (total, unit) => total + unit._count.questions,
        0
      );
      const progress = progressByMaterial.get(material.id);

      return {
        id: material.id,
        title: material.title,
        skill: material.skill,
        sourceLabel: material.sourceLabel,
        unitCount: material.units.length,
        questionCount,
        progressLabel: practiceProgressLabel(
          progress?.rounds ?? 0,
          progress?.bestCorrect ?? null,
          questionCount
        ),
        units: material.units.map((unit) => ({
          id: unit.id,
          title: unit.title,
          questionCount: unit._count.questions
        }))
      };
    });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Tự luyện</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chọn một đề để luyện thêm. Làm lại bao nhiêu lần cũng được — mỗi lần đều có
          kết quả và giải thích ngay sau khi nộp.
        </p>
      </header>
      <NoticeToast message={practiceMessage} status={practiceStatus} />
      <PracticeLibrary items={items} />
    </div>
  );
}
