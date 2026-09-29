import Link from "next/link";
import { SpeakButton } from "@/components/speak-button";
import type { DailyWord } from "@/lib/vocab-daily";

export function VocabCard({
  word,
  streakDays,
  canQuiz,
  todayCount
}: {
  word: DailyWord | null;
  streakDays: number;
  canQuiz: boolean;
  // Thẻ đến hạn + thẻ mới còn được học hôm nay (lib/vocab-deck.ts).
  todayCount: number;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Từ vựng hôm nay</h3>
        {streakDays > 0 ? (
          <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-300">
            🔥 chuỗi {streakDays} ngày
          </span>
        ) : null}
      </div>

      {word ? (
        <>
          <p className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xl font-bold tracking-tight">{word.display}</span>
            {word.phonetic ? (
              <span className="text-sm text-muted-foreground">{word.phonetic}</span>
            ) : null}
            <SpeakButton text={word.display} />
            {word.partOfSpeech ? (
              <span className="text-sm italic text-muted-foreground">
                ({word.partOfSpeech})
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-sm font-medium">{word.meaningVi}</p>
          {word.definitionEn ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{word.definitionEn}</p>
          ) : null}
          <p className="mt-3 border-l-2 border-border pl-3 text-sm italic leading-6 text-muted-foreground">
            “{word.exampleEn}”
          </p>
          {word.sourceLabel ? (
            <p className="mt-1 pl-3 text-xs text-muted-foreground">
              ↳ {word.sourceLabel}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {canQuiz && todayCount > 0 ? (
              <Link
                href="/student/vocab"
                className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
              >
                Ôn thẻ hôm nay ({todayCount}) →
              </Link>
            ) : canQuiz ? (
              <span className="text-sm font-semibold text-primary">✓ Hôm nay đã ôn xong</span>
            ) : null}
            <Link
              href="/student/vocab/words"
              className="text-sm font-semibold text-primary hover:underline"
            >
              Sổ từ →
            </Link>
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Chưa có từ nào. Thầy sẽ bổ sung kho từ vựng sớm nhé.
        </p>
      )}
    </section>
  );
}
