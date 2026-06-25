"use client";

import { useRef, useState, useTransition } from "react";

type Highlight = {
  id: string;
  selectedText: string;
  color: string;
  note: string | null;
  sourceType: string;
};

export type HighlightPayload = {
  selectedText: string;
  startOffset: number;
  endOffset: number;
  color: string;
  note: string;
};

type HighlightLayerProps = {
  text: string;
  highlights?: Highlight[];
  onHighlight: (payload: HighlightPayload) => Promise<void>;
};

type SelectionState = {
  selectedText: string;
  startOffset: number;
  endOffset: number;
};

const colors = [
  { label: "Yellow", value: "yellow", className: "bg-yellow-300" },
  { label: "Green", value: "green", className: "bg-emerald-300" },
  { label: "Blue", value: "blue", className: "bg-sky-300" },
  { label: "Pink", value: "pink", className: "bg-pink-300" }
];

function getSelectionOffsets(container: HTMLElement, range: Range) {
  const preSelectionRange = range.cloneRange();
  preSelectionRange.selectNodeContents(container);
  preSelectionRange.setEnd(range.startContainer, range.startOffset);

  const startOffset = preSelectionRange.toString().length;
  const selectedText = range.toString();

  return {
    selectedText,
    startOffset,
    endOffset: startOffset + selectedText.length
  };
}

export function HighlightLayer({ text, highlights = [], onHighlight }: HighlightLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function captureSelection() {
    const container = containerRef.current;
    const activeSelection = window.getSelection();

    if (!container || !activeSelection || activeSelection.rangeCount === 0) {
      return;
    }

    const range = activeSelection.getRangeAt(0);

    if (
      range.collapsed ||
      !container.contains(range.commonAncestorContainer) ||
      !activeSelection.toString().trim()
    ) {
      setSelection(null);
      return;
    }

    setSelection(getSelectionOffsets(container, range));
    setMessage(null);
  }

  function save(color: string) {
    if (!selection) {
      return;
    }

    const payload = {
      ...selection,
      selectedText: selection.selectedText.trim(),
      color,
      note
    };

    startTransition(async () => {
      try {
        await onHighlight(payload);
        setSelection(null);
        setNote("");
        window.getSelection()?.removeAllRanges();
        setMessage("Highlight saved.");
      } catch {
        setMessage("Could not save highlight.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        onMouseUp={captureSelection}
        onKeyUp={captureSelection}
        className="whitespace-pre-wrap rounded-md border border-border bg-background/50 p-4 text-sm leading-7 text-foreground"
      >
        {text}
      </div>

      {selection ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/50 p-3">
          <span className="text-xs font-medium text-muted-foreground">Save highlight</span>
          {colors.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => save(color.value)}
              disabled={isPending}
              title={color.label}
              className={`h-7 w-7 rounded-full border border-white/40 ${color.className} disabled:opacity-50`}
            >
              <span className="sr-only">{color.label}</span>
            </button>
          ))}
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional note"
            className="min-w-0 flex-1 rounded-md border border-border bg-background/70 px-3 py-2 text-xs outline-none focus:border-primary"
          />
        </div>
      ) : null}

      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}

      {highlights.length > 0 ? (
        <div className="space-y-2">
          {highlights.map((highlight) => (
            <blockquote
              key={highlight.id}
              className="rounded-md border border-border bg-muted/35 px-3 py-2 text-xs leading-5 text-muted-foreground"
            >
              <span className="font-medium capitalize text-foreground">{highlight.color}</span>
              {": "}
              {highlight.selectedText}
            </blockquote>
          ))}
        </div>
      ) : null}
    </div>
  );
}
