"use client";

import { useMemo, useState } from "react";
import { diffWords, type DiffSegment } from "@/lib/ai-grading/word-diff";

// Cùng cách đếm với countWords ở lib/ai-grading/input.ts (file đó kéo theo phần dựng
// đầu vào phía máy chủ, không nạp vào client).
function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function Column({
  title,
  segments,
  tone,
  words,
  hiddenOnPhone
}: {
  title: string;
  segments: DiffSegment[];
  tone: "original" | "improved";
  words: number;
  hiddenOnPhone: boolean;
}) {
  const mark =
    tone === "original"
      ? "rounded bg-red-500/15 px-0.5 text-red-800 dark:text-red-200"
      : "rounded bg-emerald-500/15 px-0.5 text-emerald-800 dark:text-emerald-200";

  return (
    <div className={hiddenOnPhone ? "hidden md:block" : ""}>
      <p
        className={`mb-1.5 border-b pb-1 text-xs font-semibold ${
          tone === "original"
            ? "border-red-400/50 text-red-700 dark:text-red-300"
            : "border-emerald-400/50 text-emerald-700 dark:text-emerald-300"
        }`}
      >
        {title} <span className="font-normal text-muted-foreground">· {words} từ</span>
      </p>
      <p className="whitespace-pre-wrap break-words text-sm leading-7">
        {segments.map((segment, index) =>
          segment.changed ? (
            <span key={index} className={mark}>
              {segment.text}
            </span>
          ) : (
            <span key={index}>{segment.text}</span>
          )
        )}
      </p>
    </div>
  );
}

// "Bản nâng cấp" của AI đặt cạnh bài gốc (kiểu youpass.vn). Máy tính: hai cột; điện
// thoại: một cột, nút gạt để đổi qua lại — đọc hai bài dài chồng lên nhau rất mỏi.
export function AiImprovedEssay({
  original,
  improved,
  audience = "student"
}: {
  original: string;
  improved: string;
  audience?: "student" | "teacher";
}) {
  const own = audience === "student" ? "Bài của em" : "Bài của học viên";
  const diff = useMemo(() => diffWords(original, improved), [original, improved]);
  const [phoneView, setPhoneView] = useState<"original" | "improved">("improved");

  const toggle = (value: "original" | "improved", label: string) => (
    <button
      type="button"
      onClick={() => setPhoneView(value)}
      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold ${
        phoneView === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs leading-5 text-muted-foreground">
        Bản nâng cấp giữ nguyên ý và bố cục của {audience === "student" ? "em" : "học viên"}, sửa hết lỗi
        và nâng từ vựng, cấu trúc câu lên khoảng một band.{" "}
        <span className="text-red-700 dark:text-red-300">Chữ đỏ</span> là chỗ bài gốc được thay,{" "}
        <span className="text-emerald-700 dark:text-emerald-300">chữ xanh</span> là cách viết mới
        {audience === "student" ? " — đọc so sánh để học cách diễn đạt, đừng chép nguyên." : "."}
      </p>
      <div className="flex rounded-lg bg-muted p-1 md:hidden">
        {toggle("original", own)}
        {toggle("improved", "Bản nâng cấp")}
      </div>
      <div className="grid gap-4 rounded-md border border-border bg-background p-4 md:grid-cols-2">
        <Column
          title={own}
          segments={diff.original}
          tone="original"
          words={countWords(original)}
          hiddenOnPhone={phoneView !== "original"}
        />
        <Column
          title="Bản nâng cấp (AI)"
          segments={diff.improved}
          tone="improved"
          words={countWords(improved)}
          hiddenOnPhone={phoneView !== "improved"}
        />
      </div>
    </div>
  );
}
