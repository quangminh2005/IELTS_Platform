"use client";

import { useRef, useState, type ReactNode } from "react";
import { matchesSearch } from "@/lib/assignment-wizard";

// Ô tìm kiếm lọc cây chọn đề. Cây do server render nên ở đây chỉ ẩn/hiện các
// nhánh theo data-search — checkbox vẫn nằm nguyên trong DOM, không mất lựa chọn.
export function UnitSearchFilter({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");

  function applyFilter(value: string) {
    setQuery(value);
    const root = rootRef.current;
    if (!root) {
      return;
    }

    // Duyệt ngược thứ tự tài liệu = con trước cha, nhờ vậy khi xét một nhánh thì
    // các nhánh con đã được ẩn/hiện xong.
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-wizard-node]")).reverse();

    nodes.forEach((node) => {
      const selfMatch = matchesSearch(node.dataset.search ?? "", value);
      const hasVisibleChild = node.querySelector("[data-wizard-node]:not([hidden])") !== null;
      const visible = selfMatch || hasVisibleChild;
      node.hidden = !visible;
      if (value && visible && node instanceof HTMLDetailsElement) {
        node.open = true;
      }
    });
  }

  return (
    <div ref={rootRef} className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(event) => applyFilter(event.target.value)}
        placeholder="Tìm bộ đề, test hoặc phần…"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
      />
      {children}
    </div>
  );
}
