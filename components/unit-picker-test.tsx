"use client";

import { useMemo, useState } from "react";

export type UnitPickerTestUnit = {
  id: string;
  title: string;
  unitType: string;
  unitNumber: number;
  defaultTimeLimitMinutes: number | null;
};

type UnitPickerTestProps = {
  label: string;
  units: UnitPickerTestUnit[];
  selectedUnitIds: string[];
  padY: string;
};

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

// 1 đề trong cây chọn phần: quản lý trạng thái tick của các phần để có nút
// "Chọn tất cả" (tích nhanh cả 4 part) đồng thời cập nhật badge "Đã chọn N".
export function UnitPickerTest({ label, units, selectedUnitIds, padY }: UnitPickerTestProps) {
  const initial = useMemo(() => new Set(selectedUnitIds), [selectedUnitIds]);
  const [checked, setChecked] = useState<Set<string>>(initial);
  const [open, setOpen] = useState(initial.size > 0);

  const selectedCount = checked.size;
  const allChecked = units.length > 0 && units.every((unit) => checked.has(unit.id));

  const toggleUnit = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setChecked(() => (allChecked ? new Set<string>() : new Set(units.map((unit) => unit.id))));
  };

  return (
    <details
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
      className="rounded-md border border-border/60 bg-background/60"
    >
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm">
        <span>
          <span className="block font-medium">{label}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{units.length} phần</span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {selectedCount > 0 ? (
            <span className="text-xs font-medium text-primary">Đã chọn {selectedCount}</span>
          ) : null}
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              toggleAll();
            }}
            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            {allChecked ? "Bỏ chọn tất cả" : "Chọn tất cả"}
          </button>
        </span>
      </summary>

      <div className="divide-y divide-border border-t border-border/60">
        {units.map((unit) => (
          <label key={unit.id} className={`flex gap-3 px-3 text-sm ${padY}`}>
            <input
              name="unitIds"
              value={unit.id}
              type="checkbox"
              checked={checked.has(unit.id)}
              onChange={() => toggleUnit(unit.id)}
              className="mt-1 h-4 w-4 rounded border-border accent-primary"
            />
            <span>
              <span className="block font-medium">{unit.title}</span>
              <span className="mt-1 block text-xs capitalize text-muted-foreground">
                Phần {unit.unitNumber} · {formatLabel(unit.unitType)}
                {unit.defaultTimeLimitMinutes ? ` · ${unit.defaultTimeLimitMinutes} phút` : ""}
              </span>
            </span>
          </label>
        ))}
      </div>
    </details>
  );
}
