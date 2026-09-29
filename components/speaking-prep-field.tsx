import {
  SPEAKING_PREP_CHOICES,
  SPEAKING_PREP_DEFAULT_SECONDS,
  formatPrepDuration
} from "@/lib/speaking-plan";

// Ô "Cho học viên lập dàn ý" + thời gian chuẩn bị mỗi câu, dùng chung cho form giao
// bài và form sửa bài giao. Server đọc bằng parseSpeakingPrepSeconds (lib/speaking-plan.ts).
export function SpeakingPrepField({ defaultSeconds }: { defaultSeconds?: number | null }) {
  const current = defaultSeconds ?? SPEAKING_PREP_DEFAULT_SECONDS;
  // Bài giao cũ có thể mang số lẻ không nằm trong danh sách — vẫn giữ để không đổi ngầm.
  const choices = SPEAKING_PREP_CHOICES.includes(current)
    ? SPEAKING_PREP_CHOICES
    : [...SPEAKING_PREP_CHOICES, current].sort((a, b) => a - b);

  return (
    <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-background p-3">
      <input
        type="checkbox"
        name="speakingPrepEnabled"
        defaultChecked={Boolean(defaultSeconds)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
      />
      <span className="text-sm leading-5">
        <span className="font-medium">Cho học viên lập dàn ý trước khi nói</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          Mỗi câu Nói có ô viết dàn ý + đồng hồ đếm ngược; hết giờ thì ô khoá lại và học viên
          mới được ghi âm. Thầy xem dàn ý ở trang chấm bài.
        </span>
        <span className="mt-2 flex items-center gap-2 text-xs">
          Thời gian chuẩn bị mỗi câu
          <select
            name="speakingPrepSeconds"
            defaultValue={String(current)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm outline-none ring-primary/40 focus:ring-2"
          >
            {choices.map((seconds) => (
              <option key={seconds} value={seconds}>
                {formatPrepDuration(seconds)}
              </option>
            ))}
          </select>
        </span>
      </span>
    </label>
  );
}
