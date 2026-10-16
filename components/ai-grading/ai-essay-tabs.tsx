"use client";

import { useState } from "react";
import { AiHighlightedEssay } from "@/components/ai-grading/ai-highlighted-essay";
import { AiImprovedEssay } from "@/components/ai-grading/ai-improved-essay";
import type { AiError } from "@/lib/ai-grading/types";

// Một bài viết trong khối "Nhận xét AI" của học viên: tab "Lỗi & cách sửa" (bài tô màu
// lỗi) và tab "Bản nâng cấp" (bài gốc cạnh bản AI viết lại). Lượt chấm cũ chưa có bản
// nâng cấp thì chỉ hiện phần lỗi như trước.
export function AiEssayTabs({
  text,
  errors,
  improved
}: {
  text: string;
  errors: AiError[];
  improved: string | null;
}) {
  const [tab, setTab] = useState<"errors" | "improved">("errors");

  if (!improved) {
    return <AiHighlightedEssay text={text} errors={errors} />;
  }

  const tabClass = (value: "errors" | "improved") =>
    `-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
      tab === value
        ? "border-primary text-primary"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-border" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "errors"}
          onClick={() => setTab("errors")}
          className={tabClass("errors")}
        >
          Lỗi & cách sửa <span className="tabular-nums opacity-70">{errors.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "improved"}
          onClick={() => setTab("improved")}
          className={tabClass("improved")}
        >
          ✨ Bản nâng cấp
        </button>
      </div>
      {tab === "errors" ? (
        <AiHighlightedEssay text={text} errors={errors} />
      ) : (
        <AiImprovedEssay original={text} improved={improved} />
      )}
    </div>
  );
}
