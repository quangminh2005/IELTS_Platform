"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { startPractice } from "@/lib/actions/practice";
import type { PracticeMaterialItem, PracticeResumeState } from "@/lib/practice-library";
import { SKILL_LABELS } from "@/lib/skills";

// Nhãn cho chip lọc: "Tất cả" (không lọc) + nhãn kỹ năng chuẩn từ lib/skills.ts —
// dùng chung một nguồn với các trang học viên khác (Nghe/Đọc/Viết/Nói).
const FILTER_LABELS: Record<string, string> = {
  all: "Tất cả",
  ...SKILL_LABELS
};

const chipClass =
  "rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:border-primary";
const activeChipClass =
  "rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary";

type PracticeTarget = {
  materialId: string;
  unitId: string | null;
  label: string;
  // Lượt đang làm dở của đúng phạm vi này (null = mở lượt mới).
  resume: PracticeResumeState | null;
  // Học viên bấm "Làm lại": bỏ lượt dở, làm lại từ đầu với lựa chọn giờ mới.
  restart: boolean;
};

export function PracticeLibrary({
  items,
  noticeMessage,
  noticeNonce
}: {
  items: PracticeMaterialItem[];
  noticeMessage?: string;
  noticeNonce?: string;
}) {
  const [search, setSearch] = useState("");
  const [skill, setSkill] = useState("all");
  const [target, setTarget] = useState<PracticeTarget | null>(null);

  // startPractice gặp lỗi (đề vừa bị gỡ khỏi thư viện, đề chưa có phần nào...)
  // thì redirect MỀM về chính trang này kèm practiceMessage — cây component
  // không unmount nên state `target` (hộp thoại đang mở) còn nguyên, khiến hộp
  // thoại cũ đứng im dưới toast lỗi và học viên bấm lại đúng nút vừa lỗi. Đóng
  // hộp thoại mỗi khi nhận được thông báo mới từ server. Phụ thuộc thêm
  // `noticeNonce` (giá trị luôn MỚI mỗi lần redirect, xem lib/practice-notices.ts)
  // chứ không chỉ mình `noticeMessage`: hai lần lỗi liên tiếp trùng y nội dung
  // (bấm trúng đúng nút vừa lỗi) sẽ cho `noticeMessage` giống hệt lần trước, effect
  // sẽ không chạy lại nếu chỉ so theo message — nonce đảm bảo luôn nhận ra "đây là
  // lần mới".
  useEffect(() => {
    if (noticeMessage) {
      setTarget(null);
    }
  }, [noticeMessage, noticeNonce]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      if (skill !== "all" && item.skill !== skill) return false;
      if (!query) return true;
      return `${item.title} ${item.sourceLabel ?? ""}`.toLowerCase().includes(query);
    });
  }, [items, search, skill]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm đề..."
          className="w-64 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.keys(FILTER_LABELS).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSkill(key)}
              className={skill === key ? activeChipClass : chipClass}
            >
              {FILTER_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Chưa có đề nào trong thư viện tự luyện. Hãy nhắc giáo viên mở thêm đề nhé.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visible.map((item) => (
            <li key={item.id} className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.sourceLabel ? `${item.sourceLabel} · ` : ""}
                {item.unitCount} phần · {item.questionCount} câu
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium text-primary">{item.progressLabel}</p>
                {/* Lượt dở có thể nằm ở một PHẦN (nút "Làm tiếp" khi đó nằm khuất
                    trong danh sách phần đang thu gọn) — chip này để học viên không
                    bỏ quên bài đang làm giữa chừng. */}
                {item.resume || item.units.some((unit) => unit.resume) ? (
                  <span className="rounded-full border border-amber-400/50 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-300">
                    Đang làm dở
                  </span>
                ) : null}
              </div>

              {/* Mở/đóng danh sách phần bằng checkbox ẩn + CSS, KHÔNG bằng state
                  React: nút cũ là <button onClick> nên bấm trước lúc trang hydrate
                  xong là mất cú bấm (đã gặp thật khi kiểm bằng trình duyệt). Cả hai
                  nhãn và <ul> đều phải là ANH EM RUỘT ngay sau ô checkbox thì biến
                  thể peer-checked mới ăn — nên <ul> nằm trong luôn hàng nút và dùng
                  w-full để tự xuống dòng riêng. */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="checkbox"
                  id={`practice-units-${item.id}`}
                  className="peer sr-only"
                />
                <PracticeStartButton
                  target={{
                    materialId: item.id,
                    unitId: null,
                    label: item.title,
                    resume: item.resume,
                    restart: false
                  }}
                  onOpenDialog={setTarget}
                  className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                >
                  {item.resume ? "Làm tiếp cả đề" : "Luyện cả đề"}
                </PracticeStartButton>
                {item.resume ? (
                  <button
                    type="button"
                    onClick={() =>
                      setTarget({
                        materialId: item.id,
                        unitId: null,
                        label: item.title,
                        resume: item.resume,
                        restart: true
                      })
                    }
                    className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-foreground"
                  >
                    Làm lại
                  </button>
                ) : null}
                <label
                  htmlFor={`practice-units-${item.id}`}
                  className="cursor-pointer select-none rounded-md border border-border px-3 py-2 text-sm font-semibold hover:border-primary peer-checked:hidden"
                >
                  Luyện từng phần
                </label>
                <label
                  htmlFor={`practice-units-${item.id}`}
                  className="hidden cursor-pointer select-none rounded-md border border-border px-3 py-2 text-sm font-semibold hover:border-primary peer-checked:inline-block"
                >
                  Ẩn các phần
                </label>

                <ul className="hidden w-full space-y-1.5 border-t border-border pt-3 peer-checked:block">
                  {item.units.map((unit) => (
                    <li key={unit.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm">
                        {unit.title}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({unit.questionCount} câu)
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <PracticeStartButton
                          target={{
                            materialId: item.id,
                            unitId: unit.id,
                            label: `${item.title} — ${unit.title}`,
                            resume: unit.resume,
                            restart: false
                          }}
                          onOpenDialog={setTarget}
                          className="rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold hover:border-primary"
                        >
                          {unit.resume ? "Làm tiếp" : "Luyện phần này"}
                        </PracticeStartButton>
                        {unit.resume ? (
                          <button
                            type="button"
                            onClick={() =>
                              setTarget({
                                materialId: item.id,
                                unitId: unit.id,
                                label: `${item.title} — ${unit.title}`,
                                resume: unit.resume,
                                restart: true
                              })
                            }
                            className="rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-foreground"
                          >
                            Làm lại
                          </button>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      )}

      {target ? <TimeChoiceDialog target={target} onClose={() => setTarget(null)} /> : null}
    </div>
  );
}

// Nút mở một phạm vi luyện. Chỉ hỏi khi câu hỏi còn nghĩa:
//   - chưa có lượt dở → hỏi "tính giờ hay không" (lượt mới, chọn sao được vậy);
//   - lượt dở CÒN đồng hồ → hỏi "giữ hay bỏ đồng hồ" (bỏ thì được, xem
//     shouldClearTimeLimitsOnResume);
//   - lượt dở KHÔNG có đồng hồ → không còn gì để hỏi (startPractice cố tình không
//     siết giờ giữa chừng), vào thẳng phòng làm bài.
function PracticeStartButton({
  target,
  onOpenDialog,
  className,
  children
}: {
  target: PracticeTarget;
  onOpenDialog: (target: PracticeTarget) => void;
  className: string;
  children: string;
}) {
  if (target.resume && !target.resume.timed) {
    return (
      <form action={startPractice}>
        <input type="hidden" name="materialId" value={target.materialId} />
        <input type="hidden" name="unitId" value={target.unitId ?? ""} />
        <input type="hidden" name="timed" value="0" />
        <PracticeSubmitButton className={className} pendingLabel="Đang mở bài…">
          {children}
        </PracticeSubmitButton>
      </form>
    );
  }

  return (
    <button type="button" onClick={() => onOpenDialog(target)} className={className}>
      {children}
    </button>
  );
}

function TimeChoiceDialog({
  target,
  onClose
}: {
  target: PracticeTarget;
  onClose: () => void;
}) {
  // Chỉ dựng portal sau khi mount ở client (document.body đã sẵn sàng).
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // Portal ra <body>: layout (AppShell) bọc nội dung trang trong div có
  // `animate-fade-in` (transform), biến div đó thành containing block cho
  // `position: fixed` — hộp thoại sẽ bị canh giữa theo TRANG thay vì màn hình
  // nếu render tại chỗ. Xem components/notice-toast.tsx, submit-celebration.tsx.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg">
        <p className="text-sm font-semibold">{target.label}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {/* Ba tình huống, ba câu hỏi khác nhau — hộp thoại không bao giờ được hỏi
              một câu mà server không thực hiện được (xem PracticeStartButton). */}
          {target.restart
            ? "Làm lại từ đầu sẽ XOÁ bài em đang làm dở. Em muốn làm lại thế nào?"
            : target.resume
              ? "Em đang làm dở bài này và đồng hồ vẫn đang đếm ngược."
              : "Em muốn làm bài này thế nào?"}
        </p>

        <div className="mt-4 space-y-2">
          <form action={startPractice}>
            <input type="hidden" name="materialId" value={target.materialId} />
            <input type="hidden" name="unitId" value={target.unitId ?? ""} />
            <input type="hidden" name="restart" value={target.restart ? "1" : "0"} />
            <input type="hidden" name="timed" value="1" />
            <PracticeSubmitButton
              className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground"
              pendingLabel="Đang mở bài…"
            >
              {target.resume && !target.restart
                ? "Làm tiếp, giữ đồng hồ"
                : "Tính giờ như thi thật"}
            </PracticeSubmitButton>
          </form>

          <form action={startPractice}>
            <input type="hidden" name="materialId" value={target.materialId} />
            <input type="hidden" name="unitId" value={target.unitId ?? ""} />
            <input type="hidden" name="restart" value={target.restart ? "1" : "0"} />
            <input type="hidden" name="timed" value="0" />
            <PracticeSubmitButton
              className="w-full rounded-md border border-border px-3 py-2.5 text-sm font-semibold hover:border-primary"
              pendingLabel="Đang mở bài…"
            >
              {target.resume && !target.restart
                ? "Làm tiếp, bỏ đồng hồ"
                : "Không tính giờ"}
            </PracticeSubmitButton>
          </form>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Huỷ
        </button>
      </div>
    </div>,
    document.body
  );
}

// Cùng idiom với ActionSubmitButton (components/action-form.tsx): useFormStatus
// phải nằm TRONG <form> nên tách component con riêng, không dùng chung được với
// ActionSubmitButton vì action ở đây (startPractice) redirect thay vì trả
// ActionResult. Khoá nút trong lúc chờ để nhấp đúp không mở hai lượt tự luyện
// song song (đóng luôn cửa sổ race dẫn tới P2002 ở AssignmentRecipient).
function PracticeSubmitButton({
  className,
  pendingLabel,
  children
}: {
  className?: string;
  pendingLabel: string;
  children: string;
}) {
  const { pending } = useFormStatus();
  // Cũng khoá cho tới khi React gắn xong sự kiện (đã kiểm bằng trình duyệt: bấm
  // ngay lúc trang vừa hiện là mất cú bấm). Server action chỉ chạy qua JS; bấm
  // sớm thì trình duyệt POST thẳng vào chính URL trang, không đi đâu cả và học
  // viên không thấy phản hồi gì. Thà nút xám vài trăm mili-giây còn hơn nuốt cú
  // bấm. Giá trị khởi tạo false để render trên server và lần render đầu ở client
  // khớp nhau (không cảnh báo hydration), effect mới bật lên.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <button
      type="submit"
      disabled={pending || !ready}
      className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
