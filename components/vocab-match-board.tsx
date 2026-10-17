"use client";

import { useEffect, useRef, useState } from "react";
import { SpeakButton } from "@/components/speak-button";
import type { SessionItem } from "@/lib/vocab-srs";

export type MatchResult = {
  item: SessionItem;
  // Nghĩa học viên nối với từ này ở lần thử ĐẦU — server chấm lại bằng nó.
  chosen: string;
  correct: boolean;
};

// Thứ tự cột nghĩa: xáo ổn định theo mã nhóm (server và trình duyệt dựng ra y hệt,
// không lệch hydrate), và không bao giờ trùng thứ tự cột từ.
function shuffledOrder(items: SessionItem[], seed: string): number[] {
  const score = (text: string) => {
    let hash = 7;

    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) | 0;
    }

    return hash;
  };
  const order = items
    .map((item, index) => ({ index, rank: score(`${seed}|${item.key}`) }))
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.index);

  return order.every((value, index) => value === index) ? [...order.slice(1), order[0]] : order;
}

const BUTTON =
  "w-full rounded-lg border px-3 py-2.5 text-left text-sm leading-5 transition break-words";

// Màn nối: bấm một từ rồi bấm nghĩa của nó (hay ngược lại). Nối đúng thì cặp đó
// khoá xanh; nối sai nháy đỏ và từ đó tính là sai ở lần đầu (hỏi lại cuối buổi).
export function VocabMatchBoard({
  items,
  onResolved,
  onNext,
  isLast
}: {
  items: SessionItem[];
  onResolved: (results: MatchResult[]) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const [meaningOrder] = useState(() => shuffledOrder(items, items[0]?.matchGroup ?? ""));
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedMeaning, setSelectedMeaning] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(() => new Set());
  const [firstTry, setFirstTry] = useState<Map<string, string>>(() => new Map());
  const [flash, setFlash] = useState<{ word: string; meaning: string } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const done = matched.size === items.length;

  useEffect(() => () => {
    if (flashTimer.current) {
      clearTimeout(flashTimer.current);
    }
  }, []);

  useEffect(() => {
    if (done) {
      nextRef.current?.focus();
    }
  }, [done]);

  function attempt(wordKey: string, meaningKey: string) {
    const meaningItem = items.find((item) => item.key === meaningKey)!;
    const correct = wordKey === meaningKey;
    const tries = new Map(firstTry);

    if (!tries.has(wordKey)) {
      tries.set(wordKey, meaningItem.question.meaningVi);
    }

    setFirstTry(tries);
    setSelectedWord(null);
    setSelectedMeaning(null);

    if (!correct) {
      setFlash({ word: wordKey, meaning: meaningKey });

      if (flashTimer.current) {
        clearTimeout(flashTimer.current);
      }

      flashTimer.current = setTimeout(() => setFlash(null), 600);
      return;
    }

    const nextMatched = new Set(matched).add(wordKey);

    setMatched(nextMatched);

    if (nextMatched.size === items.length) {
      onResolved(
        items.map((item) => {
          const chosen = tries.get(item.key) ?? item.question.meaningVi;

          return { item, chosen, correct: chosen === item.question.meaningVi };
        })
      );
    }
  }

  function pickWord(key: string) {
    if (matched.has(key) || done) {
      return;
    }

    if (selectedMeaning) {
      attempt(key, selectedMeaning);
    } else {
      setSelectedWord(key === selectedWord ? null : key);
    }
  }

  function pickMeaning(key: string) {
    if (matched.has(key) || done) {
      return;
    }

    if (selectedWord) {
      attempt(selectedWord, key);
    } else {
      setSelectedMeaning(key === selectedMeaning ? null : key);
    }
  }

  function tone(key: string, selected: string | null, flashing: boolean): string {
    if (matched.has(key)) {
      return "border-primary/40 bg-primary/10 text-primary opacity-70";
    }

    if (flashing) {
      return "border-destructive bg-destructive/10 text-destructive";
    }

    return key === selected
      ? "border-primary bg-primary/10 ring-2 ring-primary/40"
      : "border-border hover:border-primary/50";
  }

  if (done) {
    const wrongCount = items.filter((item) => {
      const chosen = firstTry.get(item.key);
      return chosen !== undefined && chosen !== item.question.meaningVi;
    }).length;

    return (
      <div className="mt-5">
        <p className={wrongCount === 0 ? "font-semibold text-primary" : "font-semibold text-destructive"}>
          {wrongCount === 0
            ? "✓ Nối đúng hết ngay lần đầu!"
            : `Nối sai ${wrongCount} từ — các từ đó sẽ được hỏi lại cuối buổi`}
        </p>
        <ul className="mt-3 space-y-2">
          {items.map((item) => {
            const chosen = firstTry.get(item.key);
            const right = chosen === undefined || chosen === item.question.meaningVi;

            return (
              <li
                key={item.key}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm"
              >
                <span className={right ? "text-primary" : "text-destructive"} aria-hidden="true">
                  {right ? "✓" : "✗"}
                </span>
                <span className="font-bold">{item.question.display}</span>
                <SpeakButton text={item.question.display} />
                <span>— {item.question.meaningVi}</span>
              </li>
            );
          })}
        </ul>
        <button
          ref={nextRef}
          type="button"
          onClick={onNext}
          className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90 sm:w-auto"
        >
          {isLast ? "Xong" : "Tiếp →"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <p className="text-base">Nối mỗi từ với nghĩa của nó:</p>
      <p className="mt-1 text-xs text-muted-foreground">Bấm một từ, rồi bấm nghĩa tương ứng.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
        <div className="space-y-2">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              disabled={matched.has(item.key)}
              aria-pressed={selectedWord === item.key}
              onClick={() => pickWord(item.key)}
              className={`${BUTTON} font-semibold ${tone(item.key, selectedWord, flash?.word === item.key)}`}
            >
              {item.question.display}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {meaningOrder.map((index) => {
            const item = items[index];

            return (
              <button
                key={item.key}
                type="button"
                disabled={matched.has(item.key)}
                aria-pressed={selectedMeaning === item.key}
                onClick={() => pickMeaning(item.key)}
                className={`${BUTTON} ${tone(item.key, selectedMeaning, flash?.meaning === item.key)}`}
              >
                {item.question.meaningVi}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
