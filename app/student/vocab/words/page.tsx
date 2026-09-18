import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SpeakButton } from "@/components/speak-button";
import { maskWordInSentence } from "@/lib/vocab-quiz";
import {
  filterVocabWords,
  groupVocabWordsByDate,
  type VocabWordEntry
} from "@/lib/vocab-words";

export const dynamic = "force-dynamic";

// Câu ví dụ với từ in đậm — cùng cách hiện như khung chữa bài trong quiz.
function ExampleSentence({ display, sentence }: { display: string; sentence: string }) {
  const masked = maskWordInSentence(display, sentence);

  if (!masked) {
    return <>“{sentence}”</>;
  }

  return (
    <>
      “{masked.before}
      <strong className="font-semibold not-italic text-foreground">{masked.match}</strong>
      {masked.after}”
    </>
  );
}

export default async function StudentVocabWordsPage({
  searchParams
}: {
  searchParams?: { q?: string };
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

  const query = searchParams?.q?.trim() ?? "";

  const [dailies, progress] = await Promise.all([
    // Chỉ những từ ĐÃ phát. select tường minh: phần đề nguồn có content rất nặng.
    prisma.vocabDaily.findMany({
      where: { word: { hidden: false } },
      orderBy: { date: "asc" },
      select: {
        date: true,
        word: {
          select: {
            id: true,
            display: true,
            phonetic: true,
            partOfSpeech: true,
            meaningVi: true,
            definitionEn: true,
            exampleEn: true,
            sourceUnit: {
              select: { title: true, material: { select: { title: true } } }
            }
          }
        }
      }
    }),
    prisma.vocabProgress.findMany({
      where: { studentId: student.id },
      select: { wordId: true, correctCount: true, wrongCount: true }
    })
  ]);

  const progressById = new Map(progress.map((row) => [row.wordId, row]));
  const seen = new Set<string>();
  const entries: VocabWordEntry[] = [];

  // Từ có thể được phát lại khi kho xoay vòng — chỉ giữ lần phát đầu.
  for (const daily of dailies) {
    if (seen.has(daily.word.id)) {
      continue;
    }

    seen.add(daily.word.id);

    const { sourceUnit, ...word } = daily.word;
    const stats = progressById.get(word.id);

    entries.push({
      ...word,
      sourceLabel: sourceUnit ? `${sourceUnit.material.title} — ${sourceUnit.title}` : null,
      releasedOn: daily.date.toISOString().slice(0, 10),
      correctCount: stats?.correctCount ?? 0,
      wrongCount: stats?.wrongCount ?? 0
    });
  }

  const filtered = filterVocabWords(entries, query);
  const groups = groupVocabWordsByDate(filtered);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">
          <Link href="/student/vocab" className="hover:underline">
            Từ vựng
          </Link>{" "}
          / Sổ từ
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">Sổ từ đã học</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {entries.length} từ đã phát, mới nhất xếp trên. Bấm 🔊 để nghe phát âm.
        </p>
      </header>

      <form className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Tìm từ tiếng Anh hoặc nghĩa Việt…"
          autoCapitalize="off"
          autoCorrect="off"
          className="w-full max-w-sm rounded-lg border border-border bg-card px-3 py-2 text-sm"
          aria-label="Tìm từ"
        />
        <button
          type="submit"
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:border-primary hover:text-primary"
        >
          Tìm
        </button>
      </form>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {query ? `Không có từ nào khớp “${query}”.` : "Chưa có từ nào được phát."}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.date} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </h3>
            <ul className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
              {group.words.map((word) => {
                const reviewed = word.correctCount + word.wrongCount > 0;

                return (
                  <li
                    key={word.id}
                    className="border-b border-border px-4 py-3 last:border-b-0"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-base font-bold">{word.display}</span>
                      {word.phonetic ? (
                        <span className="text-sm text-muted-foreground">{word.phonetic}</span>
                      ) : null}
                      <SpeakButton text={word.display} />
                      {word.partOfSpeech ? (
                        <span className="text-sm italic text-muted-foreground">
                          ({word.partOfSpeech})
                        </span>
                      ) : null}
                      <span
                        className={`ml-auto shrink-0 text-xs ${
                          reviewed && word.wrongCount > word.correctCount
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {reviewed ? `đúng ${word.correctCount} · sai ${word.wrongCount}` : "chưa ôn"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium">{word.meaningVi}</p>
                    {word.definitionEn ? (
                      <p className="text-xs text-muted-foreground">{word.definitionEn}</p>
                    ) : null}
                    <p className="mt-2 border-l-2 border-border pl-3 text-sm italic leading-6 text-muted-foreground">
                      <ExampleSentence display={word.display} sentence={word.exampleEn} />
                    </p>
                    {word.sourceLabel ? (
                      <p className="mt-0.5 pl-3 text-xs text-muted-foreground">↳ {word.sourceLabel}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
