import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VocabQuizForm } from "@/components/vocab-quiz-form";
import { buildQuiz, MIN_POOL_FOR_QUIZ, QUIZ_SIZE } from "@/lib/vocab-quiz";
import { getVocabSidebar } from "@/lib/vocab-daily";

export const dynamic = "force-dynamic";

export default async function StudentVocabPage() {
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

  const [pool, progress, sidebar] = await Promise.all([
    // Chỉ ôn những từ ĐÃ TỪNG được phát ra làm từ của ngày.
    prisma.vocabWord.findMany({
      where: { hidden: false, dailies: { some: {} } },
      select: { id: true, display: true, meaningVi: true, phonetic: true, exampleEn: true }
    }),
    prisma.vocabProgress.findMany({
      where: { studentId: student.id },
      select: {
        wordId: true,
        correctCount: true,
        wrongCount: true,
        lastAnswerAt: true
      }
    }),
    getVocabSidebar(student.id)
  ]);

  // Mỗi lần vào trang bốc một bộ khác — đây chính là nút "làm lại".
  const questions = buildQuiz({
    pool,
    progress,
    count: QUIZ_SIZE,
    seed: Math.floor(Math.random() * 1000)
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Từ vựng</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">Ôn tập từ đã học</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ôn liên tiếp {sidebar.streakDays} ngày · đã gặp {sidebar.learnedCount} từ. Mỗi lượt
          5 câu: chọn nghĩa, chọn từ và điền từ vào câu. Làm lại bao nhiêu lần cũng được,
          hệ thống giữ kết quả tốt nhất trong ngày.
        </p>
      </header>

      {questions.length > 0 ? (
        <VocabQuizForm questions={questions} />
      ) : (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Cần ít nhất {MIN_POOL_FOR_QUIZ} từ đã phát mới ôn được. Quay lại sau vài
          ngày nhé.
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        Sổ từ: {sidebar.learnedCount} từ đã ôn ·{" "}
        <Link href="/student/vocab/words" className="font-semibold text-primary hover:underline">
          xem lại tất cả từ đã học →
        </Link>
      </p>
    </div>
  );
}
