import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SpeakButton } from "@/components/speak-button";
import { VocabWordEdit } from "@/components/vocab-word-edit";
import { getWordBook } from "@/lib/vocab-deck";
import { maskWordInSentence } from "@/lib/vocab-quiz";
import {
  countByStatus,
  filterVocabWords,
  formatVietnamDate,
  groupVocabWordsByDate,
  type VocabWordEntry,
  type WordStatus
} from "@/lib/vocab-words";

export const dynamic = "force-dynamic";

// Câu ví dụ với từ in đậm — cùng cách hiện như khung chữa bài khi ôn.
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

const STATUS_STYLES: Record<WordStatus, string> = {
  unstudied: "border-border text-muted-foreground",
  new: "border-sky-400/50 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  learning: "border-amber-400/50 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  mastered: "border-emerald-400/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
};

function statusLabel(word: VocabWordEntry): string {
  switch (word.status) {
    case "unstudied":
      return "Chưa học";
    case "new":
      return "Mới";
    case "learning":
      return "Đang học";
    case "mastered":
      return "Đã thuộc";
  }
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
  const entries = await getWordBook(student.id);
  const counts = countByStatus(entries);
  const groups = groupVocabWordsByDate(filterVocabWords(entries, query));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">
          <Link href="/student/vocab" className="hover:underline">
            Từ vựng
          </Link>{" "}
          / Sổ từ
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold tracking-tight">Sổ từ của bạn</h2>
          <Link
            href="/student/vocab/flashcards"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
          >
            🃏 Lật thẻ
          </Link>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {entries.length} từ · đã thuộc {counts.mastered} · đang học{" "}
          {counts.learning + counts.new} · chưa học {counts.unstudied}. Bấm 🔊 để nghe phát âm.
          Muốn thêm từ lạ: ở trang Kết quả bài làm, bôi đen từ rồi bấm “➕ Sổ từ”.
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
          {query ? `Không có từ nào khớp “${query}”.` : "Sổ từ đang trống."}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.date} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </h3>
            <ul className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
              {group.words.map((word) => (
                <li key={word.id} className="border-b border-border px-4 py-3 last:border-b-0">
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
                    <span className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5 text-xs">
                      {word.selfAdded ? (
                        <span className="rounded-full border border-violet-400/50 bg-violet-500/10 px-2 py-0.5 font-medium text-violet-700 dark:text-violet-300">
                          Tự thêm
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full border px-2 py-0.5 font-medium ${STATUS_STYLES[word.status]}`}
                      >
                        {statusLabel(word)}
                      </span>
                      {word.dueDate && word.status !== "new" ? (
                        <span className="text-muted-foreground">
                          ôn {formatVietnamDate(word.dueDate)}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium">{word.meaningVi}</p>
                  {word.definitionEn ? (
                    <p className="text-xs text-muted-foreground">{word.definitionEn}</p>
                  ) : null}
                  {word.exampleEn ? (
                    <p className="mt-2 border-l-2 border-border pl-3 text-sm italic leading-6 text-muted-foreground">
                      <ExampleSentence display={word.display} sentence={word.exampleEn} />
                    </p>
                  ) : null}
                  {word.sourceLabel ? (
                    <p className="mt-0.5 pl-3 text-xs text-muted-foreground">↳ {word.sourceLabel}</p>
                  ) : null}
                  {word.editable && word.cardId ? (
                    <VocabWordEdit
                      cardId={word.cardId}
                      meaningVi={word.meaningVi}
                      exampleEn={word.exampleEn}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
