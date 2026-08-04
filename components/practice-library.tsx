"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { startPractice } from "@/lib/actions/practice";
import type { PracticeMaterialItem } from "@/lib/practice-library";
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
};

export function PracticeLibrary({
  items,
  noticeMessage
}: {
  items: PracticeMaterialItem[];
  noticeMessage?: string;
}) {
  const [search, setSearch] = useState("");
  const [skill, setSkill] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [target, setTarget] = useState<PracticeTarget | null>(null);

  // startPractice gặp lỗi (đề vừa bị gỡ khỏi thư viện, đề chưa có phần nào...)
  // thì redirect MỀM về chính trang này kèm practiceMessage — cây component
  // không unmount nên state `target` (hộp thoại đang mở) còn nguyên, khiến hộp
  // thoại cũ đứng im dưới toast lỗi và học viên bấm lại đúng nút vừa lỗi. Đóng
  // hộp thoại mỗi khi nhận được thông báo mới từ server.
  useEffect(() => {
    if (noticeMessage) {
      setTarget(null);
    }
  }, [noticeMessage]);

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
              <p className="mt-1 text-xs font-medium text-primary">{item.progressLabel}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setTarget({ materialId: item.id, unitId: null, label: item.title })
                  }
                  className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Luyện cả đề
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                  className="rounded-md border border-border px-3 py-2 text-sm font-semibold hover:border-primary"
                >
                  {expanded === item.id ? "Ẩn các phần" : "Luyện từng phần"}
                </button>
              </div>

              {expanded === item.id ? (
                <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                  {item.units.map((unit) => (
                    <li key={unit.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm">
                        {unit.title}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({unit.questionCount} câu)
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setTarget({
                            materialId: item.id,
                            unitId: unit.id,
                            label: `${item.title} — ${unit.title}`
                          })
                        }
                        className="rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold hover:border-primary"
                      >
                        Luyện phần này
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {target ? <TimeChoiceDialog target={target} onClose={() => setTarget(null)} /> : null}
    </div>
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
          Em muốn làm bài này thế nào?
        </p>

        <div className="mt-4 space-y-2">
          <form action={startPractice}>
            <input type="hidden" name="materialId" value={target.materialId} />
            <input type="hidden" name="unitId" value={target.unitId ?? ""} />
            <input type="hidden" name="timed" value="1" />
            <PracticeSubmitButton
              className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground"
              pendingLabel="Đang mở bài…"
            >
              Tính giờ như thi thật
            </PracticeSubmitButton>
          </form>

          <form action={startPractice}>
            <input type="hidden" name="materialId" value={target.materialId} />
            <input type="hidden" name="unitId" value={target.unitId ?? ""} />
            <input type="hidden" name="timed" value="0" />
            <PracticeSubmitButton
              className="w-full rounded-md border border-border px-3 py-2.5 text-sm font-semibold hover:border-primary"
              pendingLabel="Đang mở bài…"
            >
              Không tính giờ
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

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
