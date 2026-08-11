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
      select: { id: true, display: true, meaningVi: true }
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

  // Danh sách từ đã ôn, sai nhiều xếp trước để học viên biết chỗ cần luyện.
  const progressById = new Map(progress.map((row) => [row.wordId, row]));

  const reviewed = pool
    .filter((word) => progressById.has(word.id))
    .map((word) => ({
      ...word,
      correctCount: progressById.get(word.id)?.correctCount ?? 0,
      wrongCount: progressById.get(word.id)?.wrongCount ?? 0
    }))
    .sort((left, right) => right.wrongCount - left.wrongCount);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Từ vựng</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">Ôn tập từ đã học</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Chuỗi {sidebar.streakDays} ngày · đã gặp {sidebar.learnedCount} từ. Làm lại
          bao nhiêu lần cũng được, hệ thống giữ kết quả tốt nhất trong ngày.
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

      {reviewed.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <h3 className="border-b border-border px-5 py-3 text-base font-semibold">
            Từ đã ôn
          </h3>
          <ul className="divide-y divide-border">
            {reviewed.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
              >
                <span>
                  <span className="font-semibold">{item.display}</span>
                  <span className="text-muted-foreground"> — {item.meaningVi}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  đúng {item.correctCount} · sai {item.wrongCount}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
