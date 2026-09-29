import { SPEAKING_PREP_DEFAULT_SECONDS, splitSpeakingPrep } from "@/lib/speaking-plan";

// Ô "Cho học viên lập dàn ý" + thời gian chuẩn bị mỗi câu ([số] [phút|giây]), dùng
// chung cho form giao bài và form sửa bài giao. Server đọc bằng parseSpeakingPrepSeconds
// (lib/speaking-plan.ts) và kẹp trong 15 giây – 10 phút.
export function SpeakingPrepField({ defaultSeconds }: { defaultSeconds?: number | null }) {
  const current = splitSpeakingPrep(defaultSeconds ?? SPEAKING_PREP_DEFAULT_SECONDS);

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
        <span className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          Thời gian chuẩn bị mỗi câu
          <input
            type="number"
            name="speakingPrepAmount"
            min={1}
            max={600}
            step="any"
            defaultValue={current.amount}
            className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none ring-primary/40 focus:ring-2"
          />
          <select
            name="speakingPrepUnit"
            defaultValue={current.unit}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm outline-none ring-primary/40 focus:ring-2"
          >
            <option value="minutes">phút</option>
            <option value="seconds">giây</option>
          </select>
        </span>
        <span className="mt-1 block text-[11px] text-muted-foreground">
          Từ 15 giây đến 10 phút — vd Part 1 chọn 30 giây, Part 2 chọn 1 phút.
        </span>
      </span>
    </label>
  );
}
