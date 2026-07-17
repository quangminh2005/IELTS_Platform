import { createAssignment } from "@/lib/actions/assignments";
import { DueDateField } from "@/components/due-date-field";
import { SkillTimeInputs } from "@/components/skill-time-inputs";
import {
  StudentPicker,
  type StudentPickerClass,
  type StudentPickerStudent
} from "@/components/student-picker";
import { UnitPicker, type UnitPickerMaterial } from "@/components/unit-picker";
import { ResetOnToken } from "@/components/reset-on-token";

type AssignmentBuilderProps = {
  materials: UnitPickerMaterial[];
  students: StudentPickerStudent[];
  classOptions: StudentPickerClass[];
  // Đổi sau mỗi lần tạo bài thành công → remount form để xoá lựa chọn cũ.
  resetToken: string;
};

export function AssignmentBuilder({
  materials,
  students,
  classOptions,
  resetToken
}: AssignmentBuilderProps) {
  const hasUnits = materials.some((material) => material.units.length > 0);
  const canCreate = hasUnits && students.length > 0;

  const unitSkills: Record<string, string> = {};
  materials.forEach((material) =>
    material.units.forEach((unit) => {
      unitSkills[unit.id] = unit.skill;
    })
  );

  return (
    <ResetOnToken token={resetToken}>
    <form
      action={createAssignment}
      className="flex flex-col rounded-xl border border-border bg-card shadow-card xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)]"
    >
      {/* Header cố định: tiêu đề, hướng dẫn, hạn nộp luôn nhìn thấy khi cuộn */}
      <div className="border-b border-border p-5">
        <h3 className="text-base font-semibold">Tạo bài giao</h3>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          Chọn phần và học viên, sau đó xuất bản bài tập cho danh sách đã chọn.
        </p>

        <label className="mt-4 block text-sm font-medium" htmlFor="title">
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
          rows={2}
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
        />

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Hạn nộp</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground" htmlFor="dueDate">
                Ngày
              </label>
              <DueDateField id="dueDate" name="dueDate" />
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
      </div>

      {/* Vùng cuộn độc lập: danh sách phần + học viên */}
      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        <fieldset>
          <legend className="text-sm font-semibold">Các phần</legend>
          <div className="mt-3">
            <UnitPicker materials={materials} />
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold">Thời gian mỗi kỹ năng</legend>
          <p className="mt-1 text-xs text-muted-foreground">
            Mỗi kỹ năng là một phiên riêng, có đồng hồ riêng. Bỏ trống = không giới hạn.
          </p>
          <div className="mt-3">
            <SkillTimeInputs unitSkills={unitSkills} />
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold">Học viên</legend>
          <div className="mt-3">
            <StudentPicker students={students} classOptions={classOptions} />
          </div>
        </fieldset>
      </div>

      {/* Footer cố định: nút tạo luôn ở đáy */}
      <div className="border-t border-border p-4">
        <button
          disabled={!canCreate}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Tạo bài tập
        </button>
      </div>
    </form>
    </ResetOnToken>
  );
}
