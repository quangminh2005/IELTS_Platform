export type PromptSegment = {
  type: "text" | "blank";
  value: string;
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
