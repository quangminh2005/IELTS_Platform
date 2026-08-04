import { redirect } from "next/navigation";
import { PracticeLibrary } from "@/components/practice-library";
import { auth } from "@/lib/auth";
import { onlyPracticeRecipient } from "@/lib/practice";
import { practiceProgressLabel, type PracticeMaterialItem } from "@/lib/practice-library";
import { prisma } from "@/lib/prisma";

export default async function StudentPracticePage() {
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

  // Gộp số lượt và điểm cao nhất theo từng đề (mọi phạm vi của đề đó).
  const rounds = new Map<string, number>();
  const best = new Map<string, number>();

  for (const attempt of attempts) {
    const key = attempt.assignmentRecipient.assignment.practiceScopeKey;
    if (!key) continue;
    // Khoá có dạng studentId:materialId:unitId|all
    const materialId = key.split(":")[1];
    if (!materialId) continue;

    rounds.set(materialId, (rounds.get(materialId) ?? 0) + 1);

    // score là Float (điểm có thể lẻ ở bài chấm tay) — làm tròn để nhãn đọc gọn.
    if (attempt.score !== null) {
      best.set(materialId, Math.max(best.get(materialId) ?? 0, Math.round(attempt.score)));
    }
  }

  const items: PracticeMaterialItem[] = materials.map((material) => {
    const questionCount = material.units.reduce(
      (total, unit) => total + unit._count.questions,
      0
    );

    return {
      id: material.id,
      title: material.title,
      skill: material.skill,
      sourceLabel: material.sourceLabel,
      unitCount: material.units.length,
      questionCount,
      progressLabel: practiceProgressLabel(
        rounds.get(material.id) ?? 0,
        best.get(material.id) ?? null,
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
      <PracticeLibrary items={items} />
    </div>
  );
}
