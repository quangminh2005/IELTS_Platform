export type PromptSegment = {
  type: "text" | "blank";
  value: string;
};

export type MarkdownTable = {
  headers: string[];
  rows: string[][];
};

const dragDropTypes = new Set(["drag_drop_matching", "inline_gap_fill"]);

export function parseQuestionOptions(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.map((option) => String(option));
    }
  } catch {
    return [];
  }

  return [];
}

export function usesDragDropAnswer(questionType: string, options: string[]) {
  return dragDropTypes.has(questionType) && options.length > 0;
}

export function splitPromptIntoSegments(prompt: string): PromptSegment[] {
  const segments: PromptSegment[] = [];
  const placeholderPattern = /\[\[(\d+)\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = placeholderPattern.exec(prompt)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: prompt.slice(lastIndex, match.index) });
    }

    segments.push({ type: "blank", value: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < prompt.length) {
    segments.push({ type: "text", value: prompt.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: prompt }];
}

// Matches an authored blank: either the `[[n]]` placeholder convention or a run
// of 2+ underscores (how short-answer / sentence-completion prompts are written).
const gapPattern = /\[\[(\d+)\]\]|_{2,}/g;

export function promptHasGap(prompt: string): boolean {
  return /\[\[\d+\]\]|_{2,}/.test(prompt);
}

export function splitPromptIntoGapSegments(prompt: string): PromptSegment[] {
  const segments: PromptSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  gapPattern.lastIndex = 0;

  while ((match = gapPattern.exec(prompt)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: prompt.slice(lastIndex, match.index) });
    }

    segments.push({ type: "blank", value: match[1] ?? "" });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < prompt.length) {
    segments.push({ type: "text", value: prompt.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: prompt }];
}

function parseTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorRow(cells: string[]) {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

export function parseMarkdownTable(content: string): MarkdownTable | null {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("|"));

  if (lines.length < 2) {
    return null;
  }

  const headers = parseTableRow(lines[0]);
  const separator = parseTableRow(lines[1]);

  if (headers.length < 2 || !isSeparatorRow(separator)) {
    return null;
  }

  const rows = lines
    .slice(2)
    .map(parseTableRow)
    .filter((row) => row.length === headers.length);

  return rows.length > 0 ? { headers, rows } : null;
}
