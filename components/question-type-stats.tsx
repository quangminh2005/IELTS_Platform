"use client";

// Khối "Tỷ lệ đúng theo dạng câu": 3 tab Tất cả/Nghe/Đọc, mỗi nhóm dạng câu
// một thanh ngang. Nhóm yếu nhất (đủ dữ liệu) tô vàng kèm lời nhắn.
import { useState } from "react";
import {
  LOW_DATA_THRESHOLD,
  weakestGroup,
  type SkillFilter,
  type TypeStatsBySkill
} from "@/lib/question-stats";

const TABS: Array<{ key: SkillFilter; label: string }> = [
  { key: "all", label: "Tất cả" },
  { key: "listening", label: "Nghe" },
  { key: "reading", label: "Đọc" }
];

export function QuestionTypeStats({
  stats,
  subject = "Bạn"
}: {
  stats: TypeStatsBySkill;
  subject?: string;
}) {
  const [filter, setFilter] = useState<SkillFilter>("all");
  const rows = stats[filter];
  const weakest = weakestGroup(rows);
  const hasData = rows.some((row) => row.total > 0);

  return (
    <div className="px-5 py-4">
      <div className="flex gap-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={
              filter === tab.key
                ? "rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary"
                : "rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {hasData ? (
        <div className="mt-4 grid gap-3">
          {/* Bảng tính trên TOÀN BỘ bài đã nộp (khác biểu đồ chỉ vẽ 20 bài gần
              nhất) — ghi rõ để khỏi nhầm hai khung dữ liệu. */}
          <p className="text-xs text-muted-foreground">Tính trên toàn bộ bài đã nộp.</p>
          {rows.map((row) => {
            const isWeakest = weakest !== null && row.key === weakest.key;
            const lowData = row.total > 0 && row.total < LOW_DATA_THRESHOLD;
            const empty = row.total === 0;

            return (
              <div
                key={row.key}
                className={`rounded-lg border px-4 py-3 ${
                  isWeakest
                    ? "border-amber-400/60 bg-amber-500/10"
                    : "border-border bg-background"
                } ${empty || lowData ? "opacity-60" : ""}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold">{row.label}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {empty
                      ? "Chưa có dữ liệu"
                      : `${row.percent}% · đúng ${row.correct}/${row.total} câu${
                          lowData ? " · chưa đủ dữ liệu" : ""
                        }`}
                  </p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${
                      isWeakest ? "bg-amber-500" : "bg-primary"
                    }`}
                    style={{ width: `${row.percent}%` }}
                  />
                </div>
              </div>
            );
          })}
          {weakest ? (
            <p className="text-sm font-medium text-amber-600 dark:text-amber-300">
              {subject} đang yếu nhất ở dạng {weakest.label} — nên luyện thêm.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Chưa có bài nào ở kỹ năng này.
        </p>
      )}
    </div>
  );
}
