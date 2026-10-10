import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VocabFlashcards } from "@/components/vocab-flashcards";
import { getWordBook } from "@/lib/vocab-deck";
import {
  FLASHCARD_GROUP_LABELS,
  FLASHCARD_GROUPS,
  parseFlashcardGroup,
  wordsForFlashcards
} from "@/lib/vocab-words";

export const dynamic = "force-dynamic";

export default async function StudentVocabFlashcardsPage({
  searchParams
}: {
  searchParams?: { group?: string };
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

  const group = parseFlashcardGroup(searchParams?.group);
  const entries = await getWordBook(student.id);
  const counts = Object.fromEntries(
    FLASHCARD_GROUPS.map((key) => [key, wordsForFlashcards(entries, key).length])
  ) as Record<(typeof FLASHCARD_GROUPS)[number], number>;
  const words = wordsForFlashcards(entries, group).map((word) => ({
    id: word.id,
    display: word.display,
    phonetic: word.phonetic,
    partOfSpeech: word.partOfSpeech,
    meaningVi: word.meaningVi,
    definitionEn: word.definitionEn,
    exampleEn: word.exampleEn,
    exampleVi: word.exampleVi ?? null
  }));

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header>
        <p className="text-sm font-semibold text-primary">
          <Link href="/student/vocab" className="hover:underline">
            Từ vựng
          </Link>{" "}
          /{" "}
          <Link href="/student/vocab/words" className="hover:underline">
            Sổ từ
          </Link>{" "}
          / Lật thẻ
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">🃏 Lật thẻ</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Lướt nhanh Sổ từ: chạm thẻ để xem nghĩa, vuốt hoặc bấm Tiếp để sang thẻ khác. Lật
          thẻ không tính vào lịch ôn.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Chọn nhóm thẻ">
        {FLASHCARD_GROUPS.map((key) => (
          <Link
            key={key}
            href={`/student/vocab/flashcards?group=${key}`}
            aria-current={key === group ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
              key === group
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:border-primary hover:text-primary"
            }`}
          >
            {FLASHCARD_GROUP_LABELS[key]} ({counts[key]})
          </Link>
        ))}
      </nav>

      {/* key theo nhóm: đổi nhóm thì bộ thẻ dựng lại từ đầu. */}
      <VocabFlashcards key={group} words={words} />
    </div>
  );
}
