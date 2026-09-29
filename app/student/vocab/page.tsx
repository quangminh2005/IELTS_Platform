import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VocabReviewSession } from "@/components/vocab-review-session";
import { getReviewSession } from "@/lib/vocab-deck";
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
  const [review, sidebar] = await Promise.all([
    getReviewSession(student.id, { extraBatches }),
    getVocabSidebar(student.id)
  ]);
  const moreHref = `/student/vocab?more=${extraBatches + 1}`;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Từ vựng</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">Ôn thẻ hôm nay</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Hôm nay: <strong className="text-foreground">{review.dueCount}</strong> thẻ đến hạn ·{" "}
          <strong className="text-foreground">{review.newCount}</strong> thẻ mới
          {sidebar.streakDays > 0 ? ` · 🔥 ôn liên tiếp ${sidebar.streakDays} ngày` : ""}. Nhớ
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

      <p className="text-sm text-muted-foreground">
        Sổ từ: {sidebar.learnedCount} từ ·{" "}
        <Link href="/student/vocab/words" className="font-semibold text-primary hover:underline">
          xem lại tất cả từ →
        </Link>{" "}
        · Gặp từ lạ trong bài đọc/nghe? Ở trang Kết quả, bôi đen từ đó rồi bấm “➕ Sổ từ”.
      </p>
    </div>
  );
}
