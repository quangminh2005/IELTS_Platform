"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ActionForm, ActionSubmitButton } from "@/components/action-form";
import { useSelectionCapture } from "@/components/use-selection-capture";
import { addStudentVocabWord, lookupVocabWord, type LookupResult } from "@/lib/actions/vocab-deck";
import { cleanSelection, isAddableSelection, sentenceAround } from "@/lib/vocab-selection";

/*
  Bôi đen 1–3 từ tiếng Anh ở trang Kết quả → nút nổi "➕ Sổ từ" → khung thêm từ.
  Chỉ bọc trang kết quả của HỌC VIÊN (sau khi nộp) — trong lúc làm bài không có,
  để không thành công cụ tra nghĩa khi đang thi.

  Nút nổi và khung đều portal ra <body>: AppShell có `transform` nên position:
  fixed bên trong nó bị neo sai chỗ (bẫy đã gặp ở popup ăn mừng).
*/

type Bubble = { text: string; sentence: string; top: number; left: number };
type Draft = { display: string; sentence: string };

const BUBBLE_WIDTH = 116;
const BUBBLE_HEIGHT = 40;

// Câu chứa vùng chọn: lấy khối văn bản gần nhất rồi cắt theo dấu câu.
function sentenceOf(range: Range, container: HTMLElement, text: string): string {
  const startNode = range.startContainer;
  const startElement = startNode.nodeType === 1 ? (startNode as Element) : startNode.parentElement;
  const block = startElement?.closest("p, li, td, th, div") ?? container;
  const prefix = document.createRange();

  prefix.selectNodeContents(block);
  prefix.setEnd(range.startContainer, range.startOffset);

  const start = prefix.toString().length;

  return sentenceAround(block.textContent ?? "", start, start + text.length);
}

function AddWordDialog({
  draft,
  attemptId,
  onClose
}: {
  draft: Draft;
  attemptId: string;
  onClose: () => void;
}) {
  const [display, setDisplay] = useState(draft.display);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(true);
  const lookedUp = useRef("");

  async function runLookup(word: string) {
    const value = cleanSelection(word);

    if (!isAddableSelection(value) || value === lookedUp.current) {
      return;
    }

    lookedUp.current = value;
    setLoading(true);

    try {
      setLookup(await lookupVocabWord(value));
    } catch {
      setLookup(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void runLookup(draft.display);
    // Chỉ tra một lần lúc mở khung; đổi từ thì tra lại khi rời ô nhập.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const inBank = Boolean(lookup?.inBank);
  const alreadyAdded = Boolean(lookup?.alreadyAdded);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Thêm từ vào Sổ từ"
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-card sm:max-w-md sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-base font-semibold">➕ Thêm vào Sổ từ</h3>

        <ActionForm
          action={addStudentVocabWord}
          className="mt-4 space-y-3"
          onResult={(result) => {
            if (result.ok) {
              onClose();
            }
          }}
        >
          <input type="hidden" name="attemptId" value={attemptId} />
          <input type="hidden" name="phonetic" value={lookup?.phonetic ?? ""} />
          <input type="hidden" name="partOfSpeech" value={lookup?.partOfSpeech ?? ""} />
          <input type="hidden" name="definitionEn" value={lookup?.definitionEn ?? ""} />

          <label className="block text-xs font-medium text-muted-foreground">
            Từ
            <input
              name="display"
              value={display}
              onChange={(event) => setDisplay(event.target.value)}
              onBlur={() => void runLookup(display)}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={40}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-base font-semibold text-foreground"
            />
          </label>

          {loading ? (
            <p className="text-xs text-muted-foreground">Đang tra từ điển…</p>
          ) : lookup && (lookup.phonetic || lookup.definitionEn || lookup.partOfSpeech) ? (
            <p className="text-xs leading-5 text-muted-foreground">
              {lookup.phonetic ? <span className="mr-2">{lookup.phonetic}</span> : null}
              {lookup.partOfSpeech ? <em className="mr-2">({lookup.partOfSpeech})</em> : null}
              {lookup.definitionEn}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Không tra được từ điển — bạn tự ghi nghĩa nhé.
            </p>
          )}

          {inBank ? (
            <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              Từ này có trong kho của thầy: <strong>{lookup?.meaningVi}</strong>
            </p>
          ) : (
            <label className="block text-xs font-medium text-muted-foreground">
              Nghĩa tiếng Việt (bạn tự ghi — tự ghi sẽ nhớ lâu hơn)
              <input
                name="meaningVi"
                required
                maxLength={200}
                placeholder="vd: giảm nhẹ, làm dịu"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground"
              />
            </label>
          )}

          <label className="block text-xs font-medium text-muted-foreground">
            Câu ví dụ (lấy từ bài)
            <textarea
              name="exampleEn"
              defaultValue={draft.sentence}
              rows={3}
              maxLength={500}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>

          {alreadyAdded ? (
            <p className="text-sm font-medium text-amber-600 dark:text-amber-300">
              Từ này đã có trong Sổ từ của bạn rồi.
            </p>
          ) : null}

          <div className="flex gap-2 pt-1">
            {alreadyAdded ? null : (
              <ActionSubmitButton
                pendingLabel="Đang thêm…"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card"
              >
                Thêm vào Sổ từ
              </ActionSubmitButton>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
            >
              {alreadyAdded ? "Đóng" : "Huỷ"}
            </button>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}

export function VocabSelectionAdder({
  attemptId,
  children
}: {
  attemptId: string;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useSelectionCapture(() => {
    if (draft) {
      return;
    }

    const selection = window.getSelection();
    const container = containerRef.current;

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !container) {
      setBubble(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const text = selection.toString();

    if (!container.contains(range.commonAncestorContainer) || !isAddableSelection(text)) {
      setBubble(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    const below = rect.bottom + 8;
    const top = below + BUBBLE_HEIGHT > window.innerHeight ? rect.top - BUBBLE_HEIGHT - 8 : below;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - BUBBLE_WIDTH / 2, 8),
      window.innerWidth - BUBBLE_WIDTH - 8
    );

    setBubble({ text, sentence: sentenceOf(range, container, text), top, left });
  });

  // Cuộn trang thì nút nổi lệch khỏi chữ → ẩn đi, bôi đen lại là hiện.
  useEffect(() => {
    if (!bubble) {
      return;
    }

    const hide = () => setBubble(null);
    window.addEventListener("scroll", hide, { capture: true, passive: true });

    return () => window.removeEventListener("scroll", hide, { capture: true });
  }, [bubble]);

  return (
    <div ref={containerRef}>
      {children}
      {mounted && bubble
        ? createPortal(
            <button
              type="button"
              style={{ top: bubble.top, left: bubble.left, width: BUBBLE_WIDTH }}
              className="fixed z-50 rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-lg"
              // Giữ nguyên vùng bôi đen khi bấm trên máy tính.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setDraft({ display: cleanSelection(bubble.text), sentence: bubble.sentence });
                setBubble(null);
                window.getSelection()?.removeAllRanges();
              }}
            >
              ➕ Sổ từ
            </button>,
            document.body
          )
        : null}
      {mounted && draft
        ? createPortal(
            <AddWordDialog draft={draft} attemptId={attemptId} onClose={() => setDraft(null)} />,
            document.body
          )
        : null}
    </div>
  );
}
