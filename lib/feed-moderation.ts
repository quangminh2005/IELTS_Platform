import { foldVietnamese } from "@/lib/social";

// Lọc từ thô tục CƠ BẢN cho bình luận bảng tin (Mạng xã hội Đợt 3). Không thay được
// thầy — bình luận vẫn đăng ngay và thầy gỡ ở /teacher/feed — chỉ chặn những câu chửi
// quá lộ liễu lúc gửi.
//
// So sau khi bỏ dấu (foldVietnamese), khớp NGUYÊN TỪ. Vì bỏ dấu nên tránh các từ một
// âm tiết dễ trùng nghĩa thường ("ngu" = ngủ, "lon" = lớn, "deo" = đeo): những từ đó
// chỉ chặn trong cụm ("do ngu", "cai lon").

// Một từ (đã bỏ dấu) là đủ để chặn.
const BANNED_WORDS = new Set([
  "dm",
  "dmm",
  "dcm",
  "dkm",
  "dmml",
  "vl",
  "vcl",
  "vkl",
  "vch",
  "cc",
  "clm",
  "cmm",
  "cmnr",
  "dit",
  "fuck",
  "fucking",
  "fck",
  "shit",
  "bitch",
  "dick",
  "asshole",
  "bastard"
]);

// Cụm nhiều từ (đã bỏ dấu, cách nhau một dấu cách).
const BANNED_PHRASES = [
  "do ngu",
  "thang ngu",
  "con ngu",
  "ngu nhu",
  "oc cho",
  "nao cho",
  "con cho",
  "thang cho",
  "cho chet",
  "du ma",
  "du me",
  "dit me",
  "cai lon",
  "mat lon",
  "deo hieu",
  "deo biet",
  "im mom"
];

// "đ.m", "d-m", "c . c" → các chữ cái lẻ đứng liền nhau được ghép lại thành "dm", "cc".
function joinSingleLetters(tokens: string[]): string[] {
  const out: string[] = [];
  let run = "";
  for (const token of tokens) {
    if (token.length === 1 && /[a-z]/.test(token)) {
      run += token;
      continue;
    }
    if (run) out.push(run);
    run = "";
    out.push(token);
  }
  if (run) out.push(run);
  return out;
}

export function containsProfanity(text: string): boolean {
  const tokens = foldVietnamese(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const words = joinSingleLetters(tokens);

  if (words.some((word) => BANNED_WORDS.has(word))) return true;

  const sentence = ` ${tokens.join(" ")} `;
  return BANNED_PHRASES.some((phrase) => sentence.includes(` ${phrase} `));
}
