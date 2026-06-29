export type UnitPickerUnit = {
  id: string;
  title: string;
  skill: string;
  unitType: string;
  unitNumber: number;
  defaultTimeLimitMinutes: number | null;
};

export type UnitPickerMaterial = {
  id: string;
  title: string;
  skill: string;
  units: UnitPickerUnit[];
};

type UnitPickerProps = {
  materials: UnitPickerMaterial[];
  selectedUnitIds?: string[];
  compact?: boolean;
};

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

// Mỗi bộ đề là một khối gập/mở (<details>). Mặc định gập lại để danh sách gọn;
// checkbox bên trong vẫn nằm trong DOM nên vẫn gửi được dù đang gập.
export function UnitPicker({ materials, selectedUnitIds, compact = false }: UnitPickerProps) {
  const selected = new Set(selectedUnitIds ?? []);
  const hasUnits = materials.some((material) => material.units.length > 0);

  if (!hasUnits) {
    return (
      <p className="rounded-lg border border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
        Hãy thêm phần tài liệu trước khi tạo bài giao.
      </p>
    );
  }

  const padY = compact ? "py-2" : "py-3";

  return (
    <div className="space-y-3">
      {materials.map((material) =>
        material.units.length > 0 ? (
          <details key={material.id} className="rounded-md border border-border bg-background/40">
            <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm">
              <span>
                <span className="font-medium">{material.title}</span>
                <span className="mt-1 block text-xs capitalize text-muted-foreground">
                  {formatLabel(material.skill)} · {material.units.length} phần
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {material.units.filter((unit) => selected.has(unit.id)).length > 0
                  ? `Đã chọn ${material.units.filter((unit) => selected.has(unit.id)).length}`
                  : ""}
              </span>
            </summary>
            <div className="divide-y divide-border border-t border-border">
              {material.units.map((unit) => (
                <label key={unit.id} className={`flex gap-3 px-4 text-sm ${padY}`}>
                  <input
                    name="unitIds"
                    value={unit.id}
                    type="checkbox"
                    defaultChecked={selected.has(unit.id)}
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
        ) : null
      )}
    </div>
  );
}
