import { UnitPickerTest } from "@/components/unit-picker-test";

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
  sourceLabel: string | null;
  units: UnitPickerUnit[];
};

type UnitPickerProps = {
  materials: UnitPickerMaterial[];
  selectedUnitIds?: string[];
  compact?: boolean;
  // Bố cục rộng cho modal giao bài: các phần trong một đề xếp 2 cột.
  wide?: boolean;
};

// Thứ tự hiển thị kỹ năng trong 1 bộ đề (chuẩn IELTS).
const SKILL_ORDER = ["listening", "reading", "writing", "speaking"];

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function skillLabel(skill: string) {
  const label = formatLabel(skill);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Trích số Test để sắp xếp (VD "… Test 8" -> 8). Không có -> null.
function extractTestNumber(label: string): number | null {
  const match = label.match(/Test\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

// Nhãn hiển thị của 1 đề (VD "Test 8"). Không parse được -> dùng tên gốc.
function testLabel(label: string, fallback: string): string {
  const match = label.match(/Test\s+\d+[A-Za-z]?/i);
  return match ? match[0].replace(/\s+/g, " ") : fallback;
}

// Suy ra tên bộ đề: phần đứng trước "Test N", sau khi bỏ chữ kỹ năng và (...).
// VD "IELTS Master – Listening Test 8" -> "IELTS Master";
//    "Cambridge IELTS 20 (Academic) – Test 1" -> "Cambridge IELTS 20".
function bookLabel(label: string): string {
  let base = label.replace(/\s*\([^)]*\)/g, " ");
  const testIndex = base.search(/Test\s+\d+/i);
  if (testIndex >= 0) {
    base = base.slice(0, testIndex);
  }
  base = base.replace(/\b(listening|reading|writing|speaking)\b/gi, " ");
  base = base.replace(/[–\-:·|]+/g, " ").replace(/\s+/g, " ").trim();
  return base;
}

type TestNode = { material: UnitPickerMaterial; label: string; testNo: number | null };
type SkillNode = { skill: string; tests: TestNode[] };
type BookNode = { book: string; skills: SkillNode[] };

// Gom materials thành cây Bộ đề -> Kỹ năng -> Test, giữ thứ tự xuất hiện của bộ đề.
function buildTree(materials: UnitPickerMaterial[]): BookNode[] {
  const bookMap = new Map<string, Map<string, TestNode[]>>();

  materials.forEach((material) => {
    if (material.units.length === 0) return;
    const source = material.sourceLabel ?? material.title;
    const book = bookLabel(source) || source;

    if (!bookMap.has(book)) bookMap.set(book, new Map());
    const skillMap = bookMap.get(book)!;
    if (!skillMap.has(material.skill)) skillMap.set(material.skill, []);
    skillMap.get(material.skill)!.push({
      material,
      label: testLabel(source, material.title),
      testNo: extractTestNumber(source)
    });
  });

  const skillRank = (skill: string) => {
    const index = SKILL_ORDER.indexOf(skill);
    return index === -1 ? SKILL_ORDER.length : index;
  };

  return Array.from(bookMap.entries()).map(([book, skillMap]) => ({
    book,
    skills: Array.from(skillMap.entries())
      .sort(([a], [b]) => skillRank(a) - skillRank(b))
      .map(([skill, tests]) => ({
        skill,
        tests: tests.slice().sort((a, b) => {
          if (a.testNo != null && b.testNo != null) return a.testNo - b.testNo;
          if (a.testNo != null) return -1;
          if (b.testNo != null) return 1;
          return a.label.localeCompare(b.label);
        })
      }))
  }));
}

// Cây gập/mở 3 cấp: Bộ đề -> Kỹ năng -> Test. Mặc định gập hết cho gọn;
// khi sửa bài đã giao sẽ tự mở các nhánh đang chứa phần đã chọn.
// Checkbox luôn nằm trong DOM nên vẫn gửi được dù nhánh đang gập.
export function UnitPicker({
  materials,
  selectedUnitIds,
  compact = false,
  wide = false
}: UnitPickerProps) {
  const selected = new Set(selectedUnitIds ?? []);
  const tree = buildTree(materials);

  if (tree.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
        Hãy thêm phần tài liệu trước khi tạo bài giao.
      </p>
    );
  }

  const padY = compact ? "py-2" : "py-3";
  const countSelected = (tests: TestNode[]) =>
    tests.reduce(
      (total, test) => total + test.material.units.filter((unit) => selected.has(unit.id)).length,
      0
    );

  const selectedBadge = (count: number) =>
    count > 0 ? (
      <span className="shrink-0 text-xs font-medium text-primary">Đã chọn {count}</span>
    ) : null;

  return (
    <div className="space-y-2">
      {tree.map((bookNode) => {
        const bookTests = bookNode.skills.flatMap((skillNode) => skillNode.tests);
        const bookSelected = countSelected(bookTests);

        return (
          <details
            key={bookNode.book}
            open={bookSelected > 0}
            data-wizard-node="book"
            data-search={bookNode.book}
            className="rounded-md border border-border bg-background/40"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-sm">
              <span className="font-medium">
                {bookNode.book}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  · {bookTests.length} đề
                </span>
              </span>
              {selectedBadge(bookSelected)}
            </summary>

            <div className="space-y-2 border-t border-border p-2">
              {bookNode.skills.map((skillNode) => {
                const skillSelected = countSelected(skillNode.tests);

                return (
                  <details
                    key={skillNode.skill}
                    open={skillSelected > 0}
                    data-wizard-node="skill"
                    data-search={`${bookNode.book} ${skillLabel(skillNode.skill)}`}
                    className="rounded-md border border-border/70 bg-background/40"
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span>
                        <span className="font-medium">{skillLabel(skillNode.skill)}</span>
                        <span className="ml-1 text-xs text-muted-foreground">
                          · {skillNode.tests.length} đề
                        </span>
                      </span>
                      {selectedBadge(skillSelected)}
                    </summary>

                    <div className="space-y-2 border-t border-border/70 p-2">
                      {skillNode.tests.map((test) => {
                        const material = test.material;
                        const testSelectedIds = material.units
                          .filter((unit) => selected.has(unit.id))
                          .map((unit) => unit.id);

                        return (
                          <UnitPickerTest
                            key={material.id}
                            label={test.label}
                            units={material.units}
                            selectedUnitIds={testSelectedIds}
                            padY={padY}
                            wide={wide}
                            searchText={`${bookNode.book} ${skillLabel(skillNode.skill)} ${test.label}`}
                          />
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}
