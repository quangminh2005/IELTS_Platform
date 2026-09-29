import {
  SPEAKING_PREP_DEFAULT_SECONDS,
  isSharedSpeakingPrep,
  splitSpeakingPrep
} from "@/lib/speaking-plan";

// Ô "Cho học viên lập dàn ý" + thời gian chuẩn bị ([số] [phút|giây]) tính cho mỗi câu
// hoặc chung cả bài, dùng
// chung cho form giao bài và form sửa bài giao. Server đọc bằng parseSpeakingPrepSeconds
// (lib/speaking-plan.ts) và kẹp trong 15 giây – 10 phút.
export function SpeakingPrepField({
  defaultSeconds,
  defaultScope
}: {
  defaultSeconds?: number | null;
  defaultScope?: string | null;
}) {
  const current = splitSpeakingPrep(defaultSeconds ?? SPEAKING_PREP_DEFAULT_SECONDS);
  const shared = isSharedSpeakingPrep(defaultScope);

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
          Có ô viết dàn ý + đồng hồ đếm ngược; hết giờ thì ô khoá lại và học viên mới được
          ghi âm. Thầy xem dàn ý ở trang chấm bài.
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5">
            <input
              type="radio"
              name="speakingPrepScope"
              value="per_question"
              defaultChecked={!shared}
              className="accent-primary"
            />
            Mỗi câu một ô dàn ý riêng
          </span>
          <span className="flex items-center gap-1.5">
            <input
              type="radio"
              name="speakingPrepScope"
              value="shared"
              defaultChecked={shared}
              className="accent-primary"
            />
            Một ô chung cho cả bài
          </span>
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          Thời gian chuẩn bị
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
          Từ 15 giây đến 10 phút. &quot;Mỗi câu&quot;: mỗi câu được đúng khoảng này (vd Part 1: 30
          giây). &quot;Chung cả bài&quot;: cả bài chỉ có khoảng này (vd 2 phút cho 5 câu).
        </span>
      </span>
    </label>
  );
}
