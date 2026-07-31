import { DueDateField } from "@/components/due-date-field";
import { SkillTimeInputs } from "@/components/skill-time-inputs";
import {
  StudentPicker,
  type StudentPickerClass,
  type StudentPickerStudent
} from "@/components/student-picker";
import { UnitPicker, type UnitPickerMaterial } from "@/components/unit-picker";
import { UnitSearchFilter } from "@/components/unit-search-filter";
import { AssignmentWizard } from "@/components/assignment-wizard";
import { ResetOnToken } from "@/components/reset-on-token";

type AssignmentBuilderProps = {
  materials: UnitPickerMaterial[];
  students: StudentPickerStudent[];
  classOptions: StudentPickerClass[];
  // Đổi sau mỗi lần tạo bài thành công → remount wizard để đóng modal và xoá
  // sạch lựa chọn cũ.
  resetToken: string;
};

const fieldClass =
  "mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2";

// Dựng sẵn nội dung từng bước ở phía server rồi truyền vào vỏ modal client —
// nhờ vậy cây chọn đề (UnitPicker) vẫn là server component, không phải đẩy
// toàn bộ danh sách đề sang trình duyệt.
export function AssignmentBuilder({
  materials,
  students,
  classOptions,
  resetToken
}: AssignmentBuilderProps) {
  const hasUnits = materials.some((material) => material.units.length > 0);
  const canCreate = hasUnits && students.length > 0;
  const disabledReason = !hasUnits
    ? "Hãy thêm phần tài liệu trước khi giao bài."
    : students.length === 0
      ? "Hãy thêm học viên vào lớp trước khi giao bài."
      : null;

  const unitSkills: Record<string, string> = {};
  const unitTitles: Record<string, string> = {};
  materials.forEach((material) =>
    material.units.forEach((unit) => {
      unitSkills[unit.id] = unit.skill;
      unitTitles[unit.id] = unit.title;
    })
  );

  return (
    <ResetOnToken token={resetToken}>
      <AssignmentWizard
        canCreate={canCreate}
        disabledReason={disabledReason}
        unitTitles={unitTitles}
        unitStep={
          <UnitSearchFilter>
            <UnitPicker materials={materials} wide />
          </UnitSearchFilter>
        }
        studentStep={<StudentPicker students={students} classOptions={classOptions} />}
        settingsLeft={
          <>
            <div>
              <label className="block text-sm font-medium" htmlFor="title">
                Tiêu đề
              </label>
              <input id="title" name="title" minLength={2} required className={fieldClass} />
            </div>

            <div>
              <label className="block text-sm font-medium" htmlFor="instructions">
                Hướng dẫn
              </label>
              <textarea id="instructions" name="instructions" rows={3} className={fieldClass} />
            </div>

            <fieldset>
              <legend className="text-sm font-medium">Hạn nộp</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    className="block text-xs font-medium text-muted-foreground"
                    htmlFor="dueDate"
                  >
                    Ngày
                  </label>
                  <DueDateField id="dueDate" name="dueDate" />
                </div>
                <div>
                  <label
                    className="block text-xs font-medium text-muted-foreground"
                    htmlFor="dueTime"
                  >
                    Giờ
                  </label>
                  <input
                    id="dueTime"
                    name="dueTime"
                    type="time"
                    defaultValue="23:59"
                    className={fieldClass}
                  />
                </div>
              </div>
            </fieldset>
          </>
        }
        settingsRight={
          <>
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
              <legend className="text-sm font-semibold">Chế độ thi thật (Listening)</legend>
              <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-background p-3">
                <input
                  type="checkbox"
                  name="lockAudio"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span className="text-sm leading-5">
                  <span className="font-medium">Ẩn thanh audio</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Audio tự phát liên tục như thi thật: học viên không bấm dừng/tua được, chỉ
                    chỉnh âm lượng, và phải kiểm tra âm thanh trước khi vào bài.
                  </span>
                </span>
              </label>
            </fieldset>
          </>
        }
      />
    </ResetOnToken>
  );
}
