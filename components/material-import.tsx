import { importMaterial } from "@/lib/actions/materials";

const sampleJson = `{
  "title": "Cambridge 19 Listening Test 4",
  "skill": "listening",
  "sourceLabel": "Cambridge 19",
  "description": "Full listening test",
  "units": [
    {
      "unitType": "listening_part",
      "unitNumber": 1,
      "title": "Part 1",
      "instructions": "Complete the notes. Write ONE WORD ONLY.",
      "content": "Booking details\\n- Name of guest: [[1]]\\n- Number of nights: [[2]]",
      "audioUrl": "https://example.com/part1.mp3",
      "defaultTimeLimitMinutes": 10,
      "questions": [
        { "order": 1, "questionType": "note_completion", "prompt": "Name of guest", "answer": "Henderson" },
        { "order": 2, "questionType": "note_completion", "prompt": "Number of nights", "answer": ["three", "3"] }
      ]
    },
    {
      "unitType": "listening_part",
      "unitNumber": 2,
      "title": "Part 2",
      "content": "Questions 3-5",
      "questions": [
        {
          "order": 3,
          "questionType": "matching",
          "prompt": "Ceri",
          "options": ["A lack of confidence", "B a dislike of running", "C a lack of time"],
          "answer": "A lack of confidence"
        },
        {
          "order": 4,
          "questionType": "matching",
          "prompt": "James",
          "options": ["A lack of confidence", "B a dislike of running", "C a lack of time"],
          "answer": "C a lack of time"
        },
        {
          "order": 5,
          "questionType": "multiple_choice",
          "prompt": "What is the speaker's main point?",
          "options": ["It is cheap", "It is fast", "It is safe"],
          "answer": "It is safe"
        }
      ]
    }
  ]
}`;

const fieldClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs leading-5 outline-none ring-primary/40 focus:ring-2";

export function MaterialImport() {
  return (
    <section className="rounded-md border border-border bg-muted/45 p-5">
      <h3 className="text-lg font-semibold">Import cả đề bằng JSON</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Dán một object JSON để tạo material kèm toàn bộ phần (units) và câu hỏi trong một lần. Hệ
        thống sẽ kiểm tra `[[n]]` khớp Order, options bắt buộc, và đáp án có nằm trong options không.
      </p>

      <form action={importMaterial} className="mt-4 space-y-3">
        <textarea
          name="payload"
          rows={10}
          required
          placeholder='{"title": "...", "skill": "listening", "units": [ ... ]}'
          className={fieldClass}
        />
        <button className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Import material
        </button>
      </form>

      <details className="mt-4 rounded-md border border-border bg-background/45 p-4">
        <summary className="cursor-pointer text-sm font-semibold">Xem cấu trúc JSON mẫu</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          <li>
            <code>skill</code>: listening | reading | writing | speaking. <code>unitType</code>:
            listening_part | reading_passage | writing_task | speaking_part.
          </li>
          <li>
            Dạng điền chỗ trống (<code>note_completion</code>, <code>table_completion</code>) đặt
            <code> [[order]] </code> trong <code>content</code>, và mỗi blank phải có câu hỏi cùng
            Order.
          </li>
          <li>
            Câu chọn/match (<code>multiple_choice</code>, <code>matching</code>,
            <code> drag_drop_matching</code>, <code>inline_gap_fill</code>) cần <code>options</code>,
            và <code>answer</code> phải trùng đúng một option.
          </li>
          <li>
            <code>answer</code> có thể là chuỗi hoặc mảng (nhiều đáp án chấp nhận được).{" "}
            <code>metadata</code> là object tùy ý.
          </li>
        </ul>
        <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-background/60 p-3 text-xs leading-5">
          {sampleJson}
        </pre>
      </details>
    </section>
  );
}
