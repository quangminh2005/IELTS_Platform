// So khác biệt TỪNG CHỮ giữa bài gốc và "bản nâng cấp" của AI để tô màu hai cột cạnh
// nhau (kiểu youpass.vn): chữ bị bỏ/sửa ở bài gốc tô đỏ, chữ mới ở bản nâng cấp tô
// xanh. Thuật toán LCS trên các từ; khoảng trắng & xuống dòng giữ nguyên để hai cột
// vẫn đúng đoạn văn. Module thuần, dùng được ở client.

export type DiffSegment = { text: string; changed: boolean };
export type WordDiff = { original: DiffSegment[]; improved: DiffSegment[] };

// Bài quá dài (bảng LCS quá lớn) thì thôi không tô, chỉ hiện chữ trơn — tránh đơ máy
// điện thoại cũ. 300×400 từ ≈ 120 nghìn ô, còn xa ngưỡng này.
const MAX_CELLS = 1_500_000;

// So không phân biệt hoa/thường và bỏ dấu câu dính đầu/cuối, để "people," với
// "people" không bị coi là khác — nhưng vẫn hiện nguyên chữ gốc.
function normalize(word: string): string {
  return word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "") || word;
}

function tokenize(text: string): string[] {
  return text.match(/\S+|\s+/g) ?? [];
}

function isSpace(token: string): boolean {
  return /^\s+$/.test(token);
}

// Đánh dấu token nào là chữ "giữ nguyên" (thuộc LCS). Trả về tập chỉ số token.
function keptTokens(a: string[], b: string[]): [Set<number>, Set<number>] | null {
  const aWords = a.flatMap((token, index) => (isSpace(token) ? [] : [index]));
  const bWords = b.flatMap((token, index) => (isSpace(token) ? [] : [index]));
  const n = aWords.length;
  const m = bWords.length;
  if (n * m > MAX_CELLS) return null;

  const aKey = aWords.map((index) => normalize(a[index]));
  const bKey = bWords.map((index) => normalize(b[index]));

  // dp[i][j] = độ dài LCS của aKey[i..] và bKey[j..], trải phẳng một mảng.
  const width = m + 1;
  const dp = new Uint16Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i * width + j] =
        aKey[i] === bKey[j]
          ? dp[(i + 1) * width + j + 1] + 1
          : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
    }
  }

  const keepA = new Set<number>();
  const keepB = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (aKey[i] === bKey[j]) {
      keepA.add(aWords[i]);
      keepB.add(bWords[j]);
      i += 1;
      j += 1;
    } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return [keepA, keepB];
}

// Gộp token liền nhau cùng trạng thái thành một đoạn. Khoảng trắng nằm GIỮA hai chữ
// đều bị đổi thì tô luôn (vệt màu liền mạch); khoảng trắng còn lại để trơn.
function toSegments(tokens: string[], kept: Set<number> | null): DiffSegment[] {
  const flags = tokens.map((token, index) => {
    if (!kept) return false;
    if (!isSpace(token)) return !kept.has(index);
    return false;
  });

  tokens.forEach((token, index) => {
    if (!kept || !isSpace(token) || token.includes("\n")) return;
    if (index > 0 && index < tokens.length - 1 && flags[index - 1] && flags[index + 1]) {
      flags[index] = true;
    }
  });

  const segments: DiffSegment[] = [];
  tokens.forEach((token, index) => {
    const last = segments[segments.length - 1];
    if (last && last.changed === flags[index]) {
      last.text += token;
    } else {
      segments.push({ text: token, changed: flags[index] });
    }
  });
  return segments;
}

export function diffWords(original: string, improved: string): WordDiff {
  const a = tokenize(original);
  const b = tokenize(improved);
  const kept = keptTokens(a, b);
  return {
    original: toSegments(a, kept ? kept[0] : null),
    improved: toSegments(b, kept ? kept[1] : null)
  };
}
