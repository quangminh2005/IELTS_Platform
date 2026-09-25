import {
  SPEAKING_PREP_DEFAULT_MINUTES,
  SPEAKING_PREP_MAX_MINUTES,
  SPEAKING_PREP_MIN_MINUTES
} from "@/lib/speaking-plan";

// Ô "Cho học viên lập dàn ý" + số phút chuẩn bị, dùng chung cho form giao bài và
// form sửa bài giao. Server đọc bằng parseSpeakingPrepMinutes (lib/speaking-plan.ts).
export function SpeakingPrepField({ defaultMinutes }: { defaultMinutes?: number | null }) {
  return (
    <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-background p-3">
      <input
        type="checkbox"
        name="speakingPrepEnabled"
        defaultChecked={Boolean(defaultMinutes)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
      />
      <span className="text-sm leading-5">
        <span className="font-medium">Cho học viên lập dàn ý trước khi nói</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          Mỗi câu Nói có ô viết dàn ý + đồng hồ đếm ngược; hết giờ thì ô khoá lại và học viên
          mới được ghi âm. Cô xem dàn ý ở trang chấm bài.
        </span>
        <span className="mt-2 flex items-center gap-2 text-xs">
          Thời gian chuẩn bị
          <input
            type="number"
            name="speakingPrepMinutes"
            min={SPEAKING_PREP_MIN_MINUTES}
            max={SPEAKING_PREP_MAX_MINUTES}
            defaultValue={defaultMinutes ?? SPEAKING_PREP_DEFAULT_MINUTES}
            className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none ring-primary/40 focus:ring-2"
          />
          phút
        </span>
      </span>
    </label>
  );
}
