"use client";

import Link from "next/link";
import { useState } from "react";
import { LeaderboardRow } from "@/components/leaderboard/leaderboard-board";
import type { HomeLeaderboardData } from "@/lib/leaderboard";

// Khối bảng xếp hạng thu nhỏ ở trang chủ (kiểu chin): 2 tab Học Bá / Chuỗi, toàn
// trường, Top 5 + dòng của mình. Server đưa sẵn cả hai danh sách → đổi tab không tải lại.
export function HomeLeaderboardCard({ data, studentId }: { data: HomeLeaderboardData; studentId: string }) {
  const [tab, setTab] = useState<"xp" | "streak">("xp");
  const view = data[tab];
  const monthNumber = Number(data.monthKey.slice(5));

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Bảng xếp hạng toàn trường</h3>
        <Link href={view.href} className="shrink-0 text-sm font-semibold text-primary hover:underline">
          Xem tất cả →
        </Link>
      </div>

      <div
        role="tablist"
        aria-label="Chọn bảng"
        className="mt-3 grid grid-cols-2 rounded-lg border border-border bg-border/30 p-1 dark:bg-border/20"
      >
        {(["xp", "streak"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
              tab === key ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {key === "xp" ? `🏆 Học Bá tháng ${monthNumber}` : "🔥 Chuỗi"}
          </button>
        ))}
      </div>

      {view.top.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {tab === "xp"
            ? "Tháng này chưa ai có XP — làm bài đầu tiên để lên bảng!"
            : "Chưa ai giữ được chuỗi — học hôm nay để nhóm lửa!"}
        </p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {view.top.map((entry) => (
            <LeaderboardRow
              key={entry.studentId}
              entry={entry}
              isYou={entry.studentId === studentId}
              linkTarget="student"
            />
          ))}
          {view.me ? (
            <>
              <li aria-hidden="true" className="text-center text-xs leading-none text-muted-foreground">
                ⋯
              </li>
              <LeaderboardRow entry={view.me} isYou linkTarget="student" />
            </>
          ) : null}
        </ol>
      )}

      {!view.inBoard && view.top.length > 0 ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {tab === "xp" ? "Bạn chưa có XP tháng này." : "Bạn chưa có chuỗi — học hôm nay để bắt đầu."}
        </p>
      ) : null}
    </section>
  );
}
