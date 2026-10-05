import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VocabReviewSession } from "@/components/vocab-review-session";
import { getReviewSession } from "@/lib/vocab-deck";
import { getDayStreak } from "@/lib/day-streak-data";
import { getVocabSidebar } from "@/lib/vocab-daily";

export const dynamic = "force-dynamic";

export default async function StudentVocabPage({
  searchParams
}: {
  searchParams?: { more?: string };
}) {
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

  // ?more=N: đã bấm "Học thêm 5 từ" N lần trong hôm nay.
  const extraBatches = Math.max(0, Math.min(Number.parseInt(searchParams?.more ?? "0", 10) || 0, 10));
  const [review, sidebar, dayStreak] = await Promise.all([
    getReviewSession(student.id, { extraBatches }),
    getVocabSidebar(student.id),
    getDayStreak(student.id)
  ]);
  const streakDays = dayStreak.streak.days;
  const moreHref = `/student/vocab?more=${extraBatches + 1}`;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Từ vựng</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">Ôn thẻ hôm nay</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Hôm nay: <strong className="text-foreground">{review.dueCount}</strong> thẻ đến hạn ·{" "}
          <strong className="text-foreground">{review.newCount}</strong> thẻ mới
          {streakDays > 0 ? ` · 🔥 chuỗi ${streakDays} ngày` : ""}. Nhớ
          đúng thì thẻ giãn ra lâu hơn mới hỏi lại; quên thì ngày mai ôn lại.
        </p>
      </header>

      {review.items.length > 0 ? (
        <VocabReviewSession
          items={review.items}
          moreHref={review.canLearnMore ? moreHref : null}
        />
      ) : (
        <section className="rounded-xl border border-border bg-card p-6 text-center shadow-card">
          <p className="text-3xl" aria-hidden="true">
            ✅
          </p>
          <h3 className="mt-2 text-lg font-bold">Hôm nay hết thẻ cần ôn rồi!</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Mai quay lại ôn tiếp nhé. Muốn học thêm thì bấm bên dưới.
          </p>
          {review.canLearnMore ? (
            <a
              href={moreHref}
              className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
            >
              Học thêm 5 từ mới
            </a>
          ) : null}
        </section>
      )}

      {/* Hai lối vào Sổ từ làm thành thẻ bấm to — dòng chữ nhỏ cũ học viên hay bỏ sót. */}
      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/student/vocab/words"
          className="group flex items-center gap-4 rounded-xl border border-primary/40 bg-primary/10 p-4 shadow-card transition hover:-translate-y-0.5 hover:border-primary hover:bg-primary/15"
        >
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-2xl"
            aria-hidden="true"
          >
            📖
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-foreground">Xem lại tất cả từ</span>
            <span className="block text-sm text-muted-foreground">
              Sổ từ của em đang có <strong className="text-foreground">{sidebar.learnedCount}</strong> từ
            </span>
          </span>
          <span
            className="text-xl font-bold text-primary transition group-hover:translate-x-1"
            aria-hidden="true"
          >
            →
          </span>
        </Link>
        <Link
          href="/student/vocab/flashcards"
          className="group flex items-center gap-4 rounded-xl border border-primary/40 bg-primary/10 p-4 shadow-card transition hover:-translate-y-0.5 hover:border-primary hover:bg-primary/15"
        >
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-2xl"
            aria-hidden="true"
          >
            🃏
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-foreground">Lật thẻ</span>
            <span className="block text-sm text-muted-foreground">
              Ôn nhanh: xem từ, đoán nghĩa rồi lật thẻ kiểm tra
            </span>
          </span>
          <span
            className="text-xl font-bold text-primary transition group-hover:translate-x-1"
            aria-hidden="true"
          >
            →
          </span>
        </Link>
      </section>

      <p className="text-sm text-muted-foreground">
        💡 Gặp từ lạ trong bài đọc/nghe? Ở trang Kết quả, bôi đen từ đó rồi bấm “➕ Sổ từ”.
      </p>
    </div>
  );
}
