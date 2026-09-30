"use client";

import { useMemo, useState, type ReactNode } from "react";
import { SkillTags } from "@/components/skill-tags";
import type { MaterialCategory } from "@/lib/material-category";
import {
  defaultMaterialFilters,
  filterAndSortMaterials,
  filterMaterials,
  groupBookShelves,
  type MaterialFilters,
  type MaterialMeta,
  type PracticeFilter,
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

const tabs: { value: MaterialCategory; label: string }[] = [
  { value: "book", label: "Sách / bộ đề" },
  { value: "homework", label: "Bài tập hàng tuần" }
];

// Sách: xếp theo tên đề (Test 1, 2, 3…). Bài tập: bài mới nhất lên đầu.
const defaultSortByTab: Record<MaterialCategory, SortKey> = {
  book: "title",
  homework: "newest"
};

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Mọi trạng thái" },
  { value: "complete", label: "Đã hoàn chỉnh" },
  { value: "missing_audio", label: "Thiếu audio" },
  { value: "missing_questions", label: "Thiếu câu hỏi" },
  { value: "empty", label: "Chưa có phần" }
];

const practiceOptions: { value: PracticeFilter; label: string }[] = [
  { value: "all", label: "Mọi đề" },
  { value: "open", label: "Đang mở tự luyện" }
];

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "title", label: "Tên đề A→Z" },
  { value: "newest", label: "Mới nhất" },
  { value: "questions", label: "Nhiều câu nhất" },
  { value: "parts", label: "Nhiều phần nhất" },
  { value: "assigned", label: "Giao gần đây" }
];

const controlClass =
  "h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none ring-primary/40 focus:ring-2";

function filtersForTab(tab: MaterialCategory): MaterialFilters {
  return { ...defaultMaterialFilters, category: tab, sort: defaultSortByTab[tab] };
}

export function MaterialsBrowser({
  items,
  initialTab
}: {
  items: MaterialBrowserItem[];
  initialTab: MaterialCategory;
}) {
  const [tab, setTab] = useState<MaterialCategory>(initialTab);
  const [filters, setFilters] = useState<MaterialFilters>(() => filtersForTab(initialTab));
  const [openShelf, setOpenShelf] = useState<string | null>(null);

  const metas = useMemo(() => items.map((item) => item.meta), [items]);

  const tabCounts = useMemo(() => {
    const counts: Record<MaterialCategory, number> = { book: 0, homework: 0 };
    for (const meta of metas) counts[meta.category] += 1;
    return counts;
  }, [metas]);

  // Chỉ hiện các kỹ năng thực sự có trong tab đang xem.
  const availableSkills = useMemo(() => {
    const set = new Set(metas.filter((meta) => meta.category === tab).map((meta) => meta.skill));
    return ["listening", "reading", "writing", "speaking"].filter((skill) => set.has(skill));
  }, [metas, tab]);

  const searching = filters.search.trim() !== "";

  // Kệ sách: áp các bộ lọc kỹ năng/trạng thái/tự luyện, KHÔNG áp ô tìm kiếm
  // (khi đang tìm thì kệ ẩn đi, thẻ khớp hiện thẳng ra).
  const shelves = useMemo(
    () =>
      groupBookShelves(
        filterMaterials(metas, { ...filters, search: "", category: "book", series: "all" })
      ),
    [metas, filters]
  );

  // Kệ đang mở mà bị bộ lọc loại hết đề thì coi như đã đóng.
  const activeShelf =
    tab === "book" && openShelf && shelves.some((shelf) => shelf.name === openShelf)
      ? openShelf
      : null;
  const showShelves = tab === "book" && !searching;

  const visible = useMemo(() => {
    if (tab === "homework") {
      return filterAndSortMaterials(metas, { ...filters, category: "homework", series: "all" });
    }
    if (searching) {
      return filterAndSortMaterials(metas, { ...filters, category: "book", series: "all" });
    }
    if (activeShelf) {
      return filterAndSortMaterials(metas, { ...filters, category: "book", series: activeShelf });
    }
    return [];
  }, [metas, filters, tab, searching, activeShelf]);

  // Vị trí hiển thị (theo thứ tự đã lọc/sắp xếp) của từng thẻ đang hiện.
  // Thẻ không có trong map = bị lọc ẩn. Dùng để đặt CSS `order` + `hidden`
  // mà KHÔNG mount/unmount lại cây DOM nặng của thẻ khi đổi bộ lọc.
  const visibleOrder = useMemo(() => {
    const map = new Map<string, number>();
    visible.forEach((meta, index) => map.set(meta.id, index));
    return map;
  }, [visible]);

  const tabDefaults = filtersForTab(tab);
  const hasActiveFilter =
    searching ||
    filters.skill !== "all" ||
    filters.status !== "all" ||
    filters.practice !== "all" ||
    filters.sort !== tabDefaults.sort;

  const update = (patch: Partial<MaterialFilters>) =>
    setFilters((prev) => ({ ...prev, ...patch }));

  const resetFilters = () => {
    setFilters(filtersForTab(tab));
    setOpenShelf(null);
  };

  const switchTab = (next: MaterialCategory) => {
    if (next === tab) return;
    setTab(next);
    setFilters(filtersForTab(next));
    setOpenShelf(null);
    // Ghi tab lên URL để tải lại trang vẫn ở đúng tab. Không dùng router để
    // khỏi chạy lại server component (trang này nặng).
    try {
      window.history.replaceState(null, "", `?tab=${next}`);
    } catch {
      // Trình duyệt chặn history API thì thôi, tab vẫn đổi bình thường.
    }
  };

  const tabTotal = tabCounts[tab];
  const bookCountInShelves = shelves.reduce((sum, shelf) => sum + shelf.count, 0);
  // Kệ đang mở luôn có ít nhất 1 đề (kệ được gom từ đúng bộ lọc đó), nên ở chế
  // độ kệ chỉ cần xét kệ rỗng; còn lại xét danh sách thẻ.
  const showEmpty = showShelves ? shelves.length === 0 : visible.length === 0;

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Loại tài liệu" className="flex flex-wrap gap-2">
        {tabs.map((option) => {
          const selected = option.value === tab;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => switchTab(option.value)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-card transition ${
                selected
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-foreground hover:border-primary"
              }`}
            >
              {option.label}
              <span
                className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                  selected ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
                }`}
              >
                {tabCounts[option.value]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="relative flex-1 lg:min-w-[16rem]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={filters.search}
              onChange={(event) => update({ search: event.target.value })}
              placeholder={tab === "book" ? "Tìm đề trong mọi sách..." : "Tìm theo tên bài..."}
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

          <select
            value={filters.status}
            onChange={(event) => update({ status: event.target.value as StatusFilter })}
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
            value={filters.practice}
            onChange={(event) => update({ practice: event.target.value as PracticeFilter })}
            className={controlClass}
            aria-label="Lọc theo thư viện tự luyện"
          >
            {practiceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={filters.sort}
            onChange={(event) => update({ sort: event.target.value as SortKey })}
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
          {showShelves && !activeShelf ? (
            <p>
              <span className="font-semibold text-foreground">{shelves.length}</span> bộ sách ·{" "}
              {bookCountInShelves} đề
            </p>
          ) : (
            <p>
              Hiện <span className="font-semibold text-foreground">{visible.length}</span> /{" "}
              {tabTotal} tài liệu
            </p>
          )}
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

      {showShelves && shelves.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shelves.map((shelf) => {
            const isOpen = shelf.name === activeShelf;
            return (
              <button
                key={shelf.name}
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenShelf(isOpen ? null : shelf.name)}
                className={`flex flex-col items-start gap-2 rounded-xl border bg-card p-4 text-left shadow-card transition hover:border-primary ${
                  isOpen ? "border-primary ring-2 ring-primary/30" : "border-border"
                }`}
              >
                <span className="flex w-full items-start justify-between gap-2">
                  <span className="flex items-start gap-2 font-semibold leading-snug">
                    <BookIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                    {shelf.name}
                  </span>
                  <ChevronIcon
                    className={`mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  />
                </span>
                <SkillTags skills={shelf.skills} />
                <span className="text-sm text-muted-foreground">
                  {shelf.count} đề
                  {shelf.practiceOpenCount > 0
                    ? ` · ${shelf.practiceOpenCount} đang mở tự luyện`
                    : ""}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {showShelves && activeShelf ? (
        <div className="flex items-center justify-between gap-3 border-b border-border pb-2 pt-2">
          <h3 className="text-lg font-semibold">{activeShelf}</h3>
          <button
            type="button"
            onClick={() => setOpenShelf(null)}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Đóng
          </button>
        </div>
      ) : null}

      {/* Giữ MỌI thẻ luôn mounted; lọc/sắp xếp chỉ bật-tắt `hidden` và đổi CSS
          `order` trên lớp bọc — tránh dựng lại cây DOM khổng lồ mỗi lần đổi bộ lọc. */}
      <div className={visible.length > 0 ? "flex flex-col gap-4" : "hidden"}>
        {items.map((item) => {
          const order = visibleOrder.get(item.meta.id);
          const isVisible = order !== undefined;
          return (
            <div
              key={item.meta.id}
              className={isVisible ? undefined : "hidden"}
              style={isVisible ? { order } : undefined}
            >
              {item.card}
            </div>
          );
        })}
      </div>

      {showEmpty ? (
        <div className="rounded-xl border border-border bg-card px-5 py-12 text-center shadow-card">
          <p className="font-semibold">
            {tabTotal === 0
              ? tab === "book"
                ? "Chưa có sách / bộ đề nào"
                : "Chưa có bài tập hàng tuần nào"
              : "Không có tài liệu khớp bộ lọc"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {tabTotal === 0
              ? 'Khi tạo hoặc sửa tài liệu, chọn "Loại tài liệu" để xếp vào mục này.'
              : "Thử đổi từ khoá hoặc bỏ bớt điều kiện lọc."}
          </p>
          {tabTotal > 0 ? (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:border-primary"
            >
              Xoá bộ lọc
            </button>
          ) : null}
        </div>
      ) : null}
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

function BookIcon({ className }: { className?: string }) {
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
      <path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z" />
      <path d="M4 19.5A2 2 0 0 0 6 21h13" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
