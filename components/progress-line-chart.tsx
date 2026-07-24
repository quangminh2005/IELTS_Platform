"use client";

// Biểu đồ đường % đúng theo thời gian, 2 kỹ năng Nghe/Đọc. SVG tự vẽ (không
// thư viện) — cùng nếp với progress-ring. Trục X co giãn theo thời gian thật
// (bài cùng ngày của 2 kỹ năng thẳng hàng nhau), trục Y cố định 0-100%.
import { useState } from "react";
import type { SeriesPoint } from "@/lib/question-stats";

type SkillKey = "listening" | "reading";

const SKILL_META: Record<SkillKey, { label: string; stroke: string; fill: string; dot: string }> = {
  listening: {
    label: "Nghe",
    stroke: "stroke-primary",
    fill: "fill-primary",
    dot: "bg-primary"
  },
  reading: {
    label: "Đọc",
    stroke: "stroke-emerald-500",
    fill: "fill-emerald-500",
    dot: "bg-emerald-500"
  }
};

const WIDTH = 640;
const HEIGHT = 240;
const PAD_X = 36;
const PAD_TOP = 14;
const PAD_BOTTOM = 26;

function scaleX(timeMs: number, minMs: number, maxMs: number) {
  if (maxMs === minMs) return WIDTH / 2;
  return PAD_X + ((timeMs - minMs) / (maxMs - minMs)) * (WIDTH - PAD_X * 2);
}

function scaleY(percent: number) {
  return HEIGHT - PAD_BOTTOM - (percent / 100) * (HEIGHT - PAD_TOP - PAD_BOTTOM);
}

export function ProgressLineChart({
  listening,
  reading
}: {
  listening: SeriesPoint[];
  reading: SeriesPoint[];
}) {
  const [active, setActive] = useState<{ skill: SkillKey; index: number } | null>(null);

  const allPoints = [...listening, ...reading];
  if (allPoints.length === 0) {
    return (
      <p className="px-5 py-8 text-sm text-muted-foreground">
        Chưa có bài Nghe/Đọc nào được nộp.
      </p>
    );
  }

  const minMs = Math.min(...allPoints.map((p) => p.timeMs));
  const maxMs = Math.max(...allPoints.map((p) => p.timeMs));
  const byTime = [...allPoints].sort((a, b) => a.timeMs - b.timeMs);
  const firstLabel = byTime[0].dateLabel;
  const lastLabel = byTime[byTime.length - 1].dateLabel;

  const series: Array<{ skill: SkillKey; points: SeriesPoint[] }> = [
    { skill: "listening", points: listening },
    { skill: "reading", points: reading }
  ];

  const activePoint =
    active === null
      ? null
      : ((active.skill === "listening" ? listening : reading)[active.index] ?? null);

  return (
    <div>
      <div className="flex items-center gap-4 px-5 pt-4 text-xs font-semibold">
        {series
          .filter((s) => s.points.length > 0)
          .map((s) => (
            <span key={s.skill} className="inline-flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${SKILL_META[s.skill].dot}`} />
              {SKILL_META[s.skill].label}
            </span>
          ))}
      </div>
      <div className="relative px-2 pb-4">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          role="img"
          aria-label="Biểu đồ % đúng theo thời gian"
          onPointerLeave={() => setActive(null)}
        >
          {[0, 25, 50, 75, 100].map((tick) => (
            <g key={tick}>
              <line
                x1={PAD_X}
                x2={WIDTH - PAD_X}
                y1={scaleY(tick)}
                y2={scaleY(tick)}
                className="stroke-border"
                strokeWidth={1}
                strokeDasharray={tick === 0 ? undefined : "3 4"}
              />
              <text
                x={PAD_X - 8}
                y={scaleY(tick) + 3.5}
                textAnchor="end"
                className="fill-muted-foreground text-[10px] tabular-nums"
              >
                {tick}
              </text>
            </g>
          ))}
          <text
            x={PAD_X}
            y={HEIGHT - 6}
            className="fill-muted-foreground text-[10px] tabular-nums"
          >
            {firstLabel}
          </text>
          {lastLabel !== firstLabel ? (
            <text
              x={WIDTH - PAD_X}
              y={HEIGHT - 6}
              textAnchor="end"
              className="fill-muted-foreground text-[10px] tabular-nums"
            >
              {lastLabel}
            </text>
          ) : null}
          {series.map(({ skill, points }) =>
            points.length > 1 ? (
              <polyline
                key={skill}
                fill="none"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={SKILL_META[skill].stroke}
                points={points
                  .map((p) => `${scaleX(p.timeMs, minMs, maxMs)},${scaleY(p.percent)}`)
                  .join(" ")}
              />
            ) : null
          )}
          {series.map(({ skill, points }) =>
            points.map((point, index) => (
              <circle
                key={`${skill}-${index}`}
                cx={scaleX(point.timeMs, minMs, maxMs)}
                cy={scaleY(point.percent)}
                r={active?.skill === skill && active.index === index ? 6 : 4}
                strokeWidth={1.5}
                className={`${SKILL_META[skill].fill} cursor-pointer stroke-card`}
                onPointerEnter={() => setActive({ skill, index })}
                onClick={() => setActive({ skill, index })}
              />
            ))
          )}
        </svg>
        {active && activePoint ? (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-pop"
            style={{
              left: `${(scaleX(activePoint.timeMs, minMs, maxMs) / WIDTH) * 100}%`,
              top: `${(scaleY(activePoint.percent) / HEIGHT) * 100}%`
            }}
          >
            <p className="font-semibold">{activePoint.label}</p>
            <p className="mt-0.5 text-muted-foreground">
              {SKILL_META[active.skill].label} · ngày {activePoint.dateLabel} · đúng{" "}
              {activePoint.correct}/{activePoint.total}
              {activePoint.band !== null ? ` · Band ${activePoint.band.toFixed(1)}` : ""}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
