import { createMaterial, createQuestion, createUnit } from "@/lib/actions/materials";
import { AudioUpload } from "@/components/audio-upload";
import { QuestionFields } from "@/components/question-fields";

type MaterialEditorQuestion = {
  id: string;
  order: number;
  questionType: string;
};

type MaterialEditorUnit = {
  id: string;
  skill: string;
  unitType: string;
  unitNumber: number;
  title: string;
  questions: MaterialEditorQuestion[];
};

export type MaterialEditorMaterial = {
  id: string;
  skill: string;
  title: string;
  units: MaterialEditorUnit[];
};

type MaterialEditorProps = {
  materials: MaterialEditorMaterial[];
};

const skillOptions = [
  { value: "listening", label: "Listening" },
  { value: "reading", label: "Reading" },
  { value: "writing", label: "Writing" },
  { value: "speaking", label: "Speaking" }
];

const unitTypeOptions = [
  { value: "listening_part", label: "Listening part" },
  { value: "reading_passage", label: "Reading passage" },
  { value: "writing_task", label: "Writing task" },
  { value: "speaking_part", label: "Speaking part" }
];

const fieldClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2";

function labelFor(options: Array<{ value: string; label: string }>, value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function MaterialEditor({ materials }: MaterialEditorProps) {
  const questionUnits = materials.flatMap((material) =>
    material.units
      .filter((unit) => unit.skill === "listening" || unit.skill === "reading")
      .map((unit) => ({
        ...unit,
        materialTitle: material.title
      }))
  );

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <form action={createMaterial} className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-base font-semibold">Tài liệu mới</h3>
        <p className="mt-1 text-sm text-muted-foreground">Tạo mục mới theo kỹ năng và nguồn.</p>

        <label className="mt-4 block text-sm font-medium" htmlFor="material-title">
          Tiêu đề
        </label>
        <input id="material-title" name="title" minLength={2} required className={fieldClass} />

        <label className="mt-4 block text-sm font-medium" htmlFor="material-skill">
          Kỹ năng
        </label>
        <select id="material-skill" name="skill" required className={fieldClass}>
          <option value="">Chọn kỹ năng</option>
          {skillOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label className="mt-4 block text-sm font-medium" htmlFor="sourceLabel">
          Nguồn
        </label>
        <input
          id="sourceLabel"
          name="sourceLabel"
          placeholder="Cambridge 18, đề thi thử, bài báo..."
          className={fieldClass}
        />

        <label className="mt-4 block text-sm font-medium" htmlFor="material-description">
          Mô tả
        </label>
        <textarea id="material-description" name="description" rows={3} className={fieldClass} />

        <button className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90">
          Tạo tài liệu
        </button>
      </form>

      <form action={createUnit} className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-base font-semibold">Phần mới</h3>
        <p className="mt-1 text-sm text-muted-foreground">Phần sẽ kế thừa kỹ năng của tài liệu đã chọn.</p>

        <label className="mt-4 block text-sm font-medium" htmlFor="materialId">
          Tài liệu
        </label>
        <select id="materialId" name="materialId" required className={fieldClass}>
          <option value="">Chọn tài liệu</option>
          {materials.map((material) => (
            <option key={material.id} value={material.id}>
              {material.title} ({labelFor(skillOptions, material.skill)})
            </option>
          ))}
        </select>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem]">
          <div>
            <label className="block text-sm font-medium" htmlFor="unitType">
              Loại phần
            </label>
            <select id="unitType" name="unitType" required className={fieldClass}>
              <option value="">Chọn loại</option>
              {unitTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="unitNumber">
              Số TT
            </label>
            <input
              id="unitNumber"
              name="unitNumber"
              type="number"
              min={1}
              defaultValue={1}
              required
              className={fieldClass}
            />
          </div>
        </div>

        <label className="mt-4 block text-sm font-medium" htmlFor="unit-title">
          Tiêu đề
        </label>
        <input id="unit-title" name="title" minLength={2} required className={fieldClass} />

        <label className="mt-4 block text-sm font-medium" htmlFor="instructions">
          Hướng dẫn
        </label>
        <textarea id="instructions" name="instructions" rows={2} className={fieldClass} />

        <label className="mt-4 block text-sm font-medium" htmlFor="content">
          Nội dung
        </label>
        <textarea id="content" name="content" rows={5} required className={fieldClass} />

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium" htmlFor="new-unit-audio">
              Âm thanh
            </label>
            <AudioUpload id="new-unit-audio" />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="defaultTimeLimitMinutes">
              Thời gian
            </label>
            <input
              id="defaultTimeLimitMinutes"
              name="defaultTimeLimitMinutes"
              type="number"
              min={1}
              placeholder="Số phút"
              className={fieldClass}
            />
          </div>
        </div>

        <label className="mt-4 block text-sm font-medium" htmlFor="transcript">
          Lời thoại (transcript)
        </label>
        <textarea id="transcript" name="transcript" rows={3} className={fieldClass} />

        <label className="mt-4 block text-sm font-medium" htmlFor="metadataJson">
          Metadata (JSON)
        </label>
        <textarea id="metadataJson" name="metadataJson" rows={2} placeholder='{"part":1}' className={fieldClass} />

        <button className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90">
          Tạo phần
        </button>
      </form>

      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-base font-semibold">Câu hỏi Listening / Reading</h3>
        <p className="mt-1 text-sm text-muted-foreground">Thêm câu hỏi tự động chấm cho các phần nội dung.</p>

        <QuestionFields
          formAction={createQuestion}
          submitLabel="Tạo câu hỏi"
          idPrefix="new-question"
          units={questionUnits.map((unit) => ({
            id: unit.id,
            label: `${unit.materialTitle} - ${unit.unitNumber}. ${unit.title}`
          }))}
        />
      </div>
    </div>
  );
}
