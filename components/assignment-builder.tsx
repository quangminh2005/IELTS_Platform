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
    <form action={createAssignment} className="rounded-md border border-border bg-muted/45 p-5">
      <div>
        <h3 className="text-lg font-semibold">Create assignment</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Choose units and students, then publish homework for the selected roster.
        </p>
      </div>

      <label className="mt-5 block text-sm font-medium" htmlFor="title">
        Title
      </label>
      <input
        id="title"
        name="title"
        minLength={2}
        required
        className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2"
      />

      <label className="mt-4 block text-sm font-medium" htmlFor="instructions">
        Instructions
      </label>
      <textarea
        id="instructions"
        name="instructions"
        rows={4}
        className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2"
      />

      <label className="mt-4 block text-sm font-medium" htmlFor="timeLimitMinutes">
        Time limit
      </label>
      <input
        id="timeLimitMinutes"
        name="timeLimitMinutes"
        type="number"
        min={1}
        placeholder="Optional minutes"
        className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2"
      />

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold">Units</legend>
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
                            Unit {unit.unitNumber} | {formatLabel(unit.unitType)}
                            {unit.defaultTimeLimitMinutes
                              ? ` | ${unit.defaultTimeLimitMinutes} min default`
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
            <p className="rounded-md border border-border bg-background/40 px-4 py-5 text-sm text-muted-foreground">
              Add material units before creating an assignment.
            </p>
          )}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold">Students</legend>
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
              Add students to a class before assigning work.
            </p>
          )}
        </div>
      </fieldset>

      <button
        disabled={!canCreate}
        className="mt-6 w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        Create homework
      </button>
    </form>
  );
}
