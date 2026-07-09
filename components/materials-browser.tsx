"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  defaultMaterialFilters,
  filterAndSortMaterials,
  type MaterialFilters,
  type MaterialMeta,
  type SortKey,
  type StatusFilter
} from "@/lib/materials-filter";

export type MaterialBrowserItem = {
  meta: MaterialMeta;
  card: ReactNode;
};

const skillLabels: Record<string, string> = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking"
};

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Mọi trạng thái" },
  { value: "complete", label: "Đã hoàn chỉnh" },
  { value: "missing_audio", label: "Thiếu audio" },
  { value: "missing_questions", label: "Thiếu câu hỏi" },
  { value: "empty", label: "Chưa có phần" }
];

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Mới nhất" },
  { value: "questions", label: "Nhiều câu nhất" },
  { value: "parts", label: "Nhiều phần nhất" },
  { value: "assigned", label: "Giao gần đây" }
];

const controlClass =
  "h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none ring-primary/40 focus:ring-2";

export function MaterialsBrowser({ items }: { items: MaterialBrowserItem[] }) {
  const [filters, setFilters] = useState<MaterialFilters>(defaultMaterialFilters);

  const cardById = useMemo(() => {
    const map = new Map<string, ReactNode>();
    for (const item of items) map.set(item.meta.id, item.card);
    return map;
  }, [items]);

  // Chỉ hiện các kỹ năng thực sự có trong kho.
  const availableSkills = useMemo(() => {
    const set = new Set(items.map((item) => item.meta.skill));
    return ["listening", "reading", "writing", "speaking"].filter((skill) =>
      set.has(skill)
    );
  }, [items]);

  // Danh sách bộ sách suy ra được, sắp theo alphabet (vi).
  const availableSeries = useMemo(() => {
    const set = new Set(items.map((item) => item.meta.series));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [items]);

  const visible = useMemo(
    () => filterAndSortMaterials(items.map((item) => item.meta), filters),
    [items, filters]
  );

  const hasActiveFilter =
    filters.search.trim() !== "" ||
    filters.skill !== "all" ||
    filters.series !== "all" ||
    filters.status !== "all";

  const update = (patch: Partial<MaterialFilters>) =>
    setFilters((prev) => ({ ...prev, ...patch }));

  const resetFilters = () => setFilters(defaultMaterialFilters);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="relative flex-1 lg:min-w-[16rem]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={filters.search}
              onChange={(event) => update({ search: event.target.value })}
              placeholder="Tìm theo tên đề / passage..."
              className={`${controlClass} w-full pl-9`}
              aria-label="Tìm tài liệu"
            />
          </div>

          <select
            value={filters.skill}
            onChange={(event) => update({ skill: event.target.value })}
            className={controlClass}
            aria-label="Lọc theo kỹ năng"
          >
            <option value="all">Mọi kỹ năng</option>
            {availableSkills.map((skill) => (
              <option key={skill} value={skill}>
                {skillLabels[skill] ?? skill}
              </option>
            ))}
          </select>

          {availableSeries.length > 1 ? (
            <select
              value={filters.series}
              onChange={(event) => update({ series: event.target.value })}
              className={controlClass}
              aria-label="Lọc theo bộ sách"
            >
              <option value="all">Mọi bộ sách</option>
              {availableSeries.map((series) => (
                <option key={series} value={series}>
                  {series}
                </option>
              ))}
            </select>
          ) : null}

          <select
            value={filters.status}
            onChange={(event) =>
              update({ status: event.target.value as StatusFilter })
            }
            className={controlClass}
            aria-label="Lọc theo trạng thái"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={filters.sort}
            onChange={(event) =>
              update({ sort: event.target.value as SortKey })
            }
            className={controlClass}
            aria-label="Sắp xếp"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                Sắp xếp: {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>
            Hiện <span className="font-semibold text-foreground">{visible.length}</span> / {items.length} tài liệu
          </p>
          {hasActiveFilter ? (
            <button
              type="button"
              onClick={resetFilters}
              className="font-semibold text-primary hover:underline"
            >
              Xoá bộ lọc
            </button>
          ) : null}
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="space-y-4">
          {visible.map((meta) => (
            <div key={meta.id}>{cardById.get(meta.id)}</div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card px-5 py-12 text-center shadow-card">
          <p className="font-semibold">Không có tài liệu khớp bộ lọc</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Thử đổi từ khoá hoặc bỏ bớt điều kiện lọc.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:border-primary"
          >
            Xoá bộ lọc
          </button>
        </div>
      )}
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
