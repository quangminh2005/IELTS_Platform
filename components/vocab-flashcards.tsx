"use client";

import { useEffect, useRef, useState } from "react";
import { SpeakButton } from "@/components/speak-button";
import { maskWordInSentence } from "@/lib/vocab-quiz";

// Chỉ những gì mặt thẻ cần — không gửi cả dòng Sổ từ xuống trình duyệt.
export type FlashcardWord = {
  id: string;
  display: string;
  phonetic: string | null;
  partOfSpeech: string | null;
  meaningVi: string;
  definitionEn: string | null;
  exampleEn: string;
  exampleVi: string | null;
};

// Vuốt ngang ít nhất chừng này (px) mới tính là chuyển thẻ.
const SWIPE_MIN = 50;

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function Example({ word }: { word: FlashcardWord }) {
  if (!word.exampleEn) {
    return null;
  }

  const masked = maskWordInSentence(word.display, word.exampleEn);

  return (
    <p className="mt-4 border-l-2 border-border pl-3 text-left text-sm italic leading-6 text-muted-foreground">
      {masked ? (
        <>
          “{masked.before}
          <strong className="font-semibold not-italic text-foreground">{masked.match}</strong>
          {masked.after}”
        </>
      ) : (
        <>“{word.exampleEn}”</>
      )}
      {word.exampleVi ? (
        <span className="mt-1 block text-[13px] not-italic leading-5 text-muted-foreground/90">
          {word.exampleVi}
        </span>
      ) : null}
    </p>
  );
}

/*
  Lật thẻ để lướt nhanh Sổ từ: mặt trước là từ + 🔊, chạm để lật ra nghĩa + câu
  ví dụ. KHÔNG gọi server, KHÔNG đổi lịch ôn — ghi nhớ thật vẫn tính qua trang
  "Ôn thẻ hôm nay" có máy chấm. Chuyển thẻ: nút, phím ←/→, vuốt ngang; lật: chạm
  vào thẻ, phím Space/Enter.
*/
export function VocabFlashcards({ words }: { words: FlashcardWord[] }) {
  const [deck, setDeck] = useState(words);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const word = deck[index];
  const finished = index >= deck.length;

  function go(delta: number) {
    setFlipped(false);
    setIndex((current) => Math.min(Math.max(current + delta, 0), deck.length));
  }

  function restart(shuffle: boolean) {
    setDeck((current) => (shuffle ? shuffled(current) : current));
    setIndex(0);
    setFlipped(false);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;

      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }

      if (event.key === "ArrowRight") {
        go(1);
      } else if (event.key === "ArrowLeft") {
        go(-1);
      } else if ((event.key === " " || event.key === "Enter") && !finished) {
        // Space/Enter đang đứng ở một nút thì để nút tự xử lý.
        if (target?.tagName === "BUTTON" && target.dataset.card !== "true") {
          return;
        }

        event.preventDefault();
        setFlipped((current) => !current);
      }
    }

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  });

  if (deck.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Nhóm này chưa có từ nào.
      </p>
    );
  }

  if (finished || !word) {
    return (
      <section className="rounded-xl border border-primary/30 bg-primary/5 p-6 text-center shadow-card">
        <p className="text-3xl" aria-hidden="true">
          🃏
        </p>
        <h3 className="mt-2 text-lg font-bold">Đã lật hết {deck.length} thẻ!</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Muốn chắc là nhớ thật thì vào “Ôn thẻ hôm nay” để máy hỏi lại nhé.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => restart(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
          >
            Trộn và lật lại
          </button>
          <a
            href="/student/vocab"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:border-primary hover:text-primary"
          >
            Ôn thẻ hôm nay
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Thẻ {index + 1}/{deck.length}
        </span>
        <button
          type="button"
          onClick={() => restart(true)}
          className="rounded-full border border-border px-3 py-1 font-semibold transition hover:border-primary hover:text-primary"
        >
          🔀 Trộn thẻ
        </button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.round(((index + 1) / deck.length) * 100)}%` }}
        />
      </div>

      <div
        role="button"
        tabIndex={0}
        data-card="true"
        aria-label={flipped ? "Mặt sau — chạm để lật lại" : "Mặt trước — chạm để xem nghĩa"}
        onClick={(event) => {
          // Bấm nút 🔊 trong thẻ thì chỉ đọc, không lật.
          if ((event.target as HTMLElement).closest("button")) {
            return;
          }

          setFlipped((current) => !current);
        }}
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStartX.current;
          const end = event.changedTouches[0]?.clientX;
          touchStartX.current = null;

          if (start === null || end === undefined || Math.abs(end - start) < SWIPE_MIN) {
            return;
          }

          event.preventDefault();
          go(end < start ? 1 : -1);
        }}
        className={`flex min-h-[18rem] cursor-pointer select-none flex-col items-center justify-center rounded-2xl border p-6 text-center shadow-card outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
          flipped ? "border-primary/40 bg-primary/5" : "border-border bg-card"
        }`}
      >
        <div key={`${word.id}-${flipped}`} className="w-full animate-fade-in">
          <p className="flex flex-wrap items-center justify-center gap-2">
            <span className={`${flipped ? "text-2xl" : "text-4xl"} font-bold tracking-tight`}>
              {word.display}
            </span>
            <SpeakButton text={word.display} />
          </p>

          {flipped ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                {word.phonetic ? <span className="mr-2">{word.phonetic}</span> : null}
                {word.partOfSpeech ? <em>({word.partOfSpeech})</em> : null}
              </p>
              <p className="mt-3 text-xl font-semibold text-primary">{word.meaningVi}</p>
              {word.definitionEn ? (
                <p className="mt-1 text-xs text-muted-foreground">{word.definitionEn}</p>
              ) : null}
              <Example word={word} />
            </>
          ) : (
            <p className="mt-6 text-xs text-muted-foreground">Chạm để xem nghĩa</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold transition hover:border-primary hover:text-primary disabled:opacity-40"
        >
          ← Trước
        </button>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          Phím ←/→ chuyển thẻ · Space lật thẻ
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
        >
          {index + 1 < deck.length ? "Tiếp →" : "Xong"}
        </button>
      </div>
    </section>
  );
}
