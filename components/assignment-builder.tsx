import { createAssignment } from "@/lib/actions/assignments";

type UnitOption = {
  id: string;
  title: string;
  skill: string;
  unitType: string;
  unitNumber: number;
  defaultTimeLimitMinutes: number | null;
};

type MaterialGroup = {
  id: string;
  title: string;
  skill: string;
  units: UnitOption[];
};

type StudentOption = {
  id: string;
  displayName: string;
  email: string;
  classes: string[];
};

type AssignmentBuilderProps = {
  materials: MaterialGroup[];
  students: StudentOption[];
};

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function AssignmentBuilder({ materials, students }: AssignmentBuilderProps) {
  const hasUnits = materials.some((material) => material.units.length > 0);
  const canCreate = hasUnits && students.length > 0;

  return (
    <form action={createAssignment} className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div>
        <h3 className="text-base font-semibold">Tạo bài giao</h3>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          Chọn phần và học viên, sau đó xuất bản bài tập cho danh sách đã chọn.
        </p>
      </div>

      <label className="mt-5 block text-sm font-medium" htmlFor="title">
        Tiêu đề
      </label>
      <input
        id="title"
        name="title"
        minLength={2}
        required
        className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
      />

      <label className="mt-4 block text-sm font-medium" htmlFor="instructions">
        Hướng dẫn
      </label>
      <textarea
        id="instructions"
        name="instructions"
        rows={4}
        className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
      />

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Hạn nộp</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-muted-foreground" htmlFor="dueDate">
              Ngày
            </label>
            <input
              id="dueDate"
              name="dueDate"
              type="date"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground" htmlFor="dueTime">
              Giờ
            </label>
            <input
              id="dueTime"
              name="dueTime"
              type="time"
              defaultValue="23:59"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold">Các phần</legend>
        <div className="mt-3 space-y-3">
          {hasUnits ? (
            materials.map((material) =>
              material.units.length > 0 ? (
                <section key={material.id} className="rounded-md border border-border bg-background/40">
                  <div className="border-b border-border px-4 py-3">
                    <p className="font-medium">{material.title}</p>
                    <p className="mt-1 text-xs capitalize text-muted-foreground">
                      {formatLabel(material.skill)}
                    </p>
                  </div>
                  <div className="divide-y divide-border">
                    {material.units.map((unit) => (
                      <label key={unit.id} className="flex gap-3 px-4 py-3 text-sm">
                        <input
                          name="unitIds"
                          value={unit.id}
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-border accent-primary"
                        />
                        <span>
                          <span className="block font-medium">{unit.title}</span>
                          <span className="mt-1 block text-xs capitalize text-muted-foreground">
                            Phần {unit.unitNumber} · {formatLabel(unit.unitType)}
                            {unit.defaultTimeLimitMinutes
                              ? ` · ${unit.defaultTimeLimitMinutes} phút`
                              : ""}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
              ) : null
            )
          ) : (
            <p className="rounded-lg border border-border bg-muted/60 px-4 py-5 text-sm text-muted-foreground">
              Hãy thêm phần tài liệu trước khi tạo bài giao.
            </p>
          )}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold">Học viên</legend>
        <div className="mt-3 divide-y divide-border rounded-md border border-border bg-background/40">
          {students.length > 0 ? (
            students.map((student) => (
              <label key={student.id} className="flex gap-3 px-4 py-3 text-sm">
                <input
                  name="studentIds"
                  value={student.id}
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-border accent-primary"
                />
                <span>
                  <span className="block font-medium">{student.displayName}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {student.email}
                    {student.classes.length > 0 ? ` | ${student.classes.join(", ")}` : ""}
                  </span>
                </span>
              </label>
            ))
          ) : (
            <p className="px-4 py-5 text-sm text-muted-foreground">
              Hãy thêm học viên vào lớp trước khi giao bài.
            </p>
          )}
        </div>
      </fieldset>

      <button
        disabled={!canCreate}
        className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Tạo bài tập
      </button>
    </form>
  );
}
