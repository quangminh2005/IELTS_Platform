"use client";

import { useRef, useState, type ReactNode } from "react";
import { matchesSearch } from "@/lib/assignment-wizard";

// Ô tìm kiếm lọc cây chọn đề. Chỉ ẩn/hiện các nhánh theo data-search —
// checkbox vẫn nằm nguyên trong DOM, không mất lựa chọn.
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
      // Chỉ đặt thuộc tính `hidden` là chưa đủ: nhiều nhánh (thẻ <label> phần
      // trong 1 đề) mang sẵn class Tailwind `flex`, mà Tailwind sinh luật
      // `[hidden]{display:none}` ở @layer base trong khi `.flex` nằm ở @layer
      // utilities — layer sau thắng nên `flex` đè lên `hidden`, phần tử vẫn
      // hiện dù đã set hidden. Toggle thêm class "hidden" (được sinh sau
      // "flex" trong bảng utility) để chắc chắn thắng, đồng thời giữ nguyên
      // thuộc tính hidden vì thuật toán duyệt cây dựa vào selector
      // [data-wizard-node]:not([hidden]) và nó đúng ngữ nghĩa/trợ năng.
      node.classList.toggle("hidden", !visible);
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
