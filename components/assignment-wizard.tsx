"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createAssignment } from "@/lib/actions/assignments";
import {
  WIZARD_STEPS,
  maxReachableStep,
  stepBlocker,
  submitLabel,
  summaryLabel,
  type WizardCounts,
  type WizardStep
} from "@/lib/assignment-wizard";

type AssignmentWizardProps = {
  unitStep: ReactNode;
  studentStep: ReactNode;
  settingsLeft: ReactNode;
  settingsRight: ReactNode;
  canCreate: boolean;
  disabledReason: string | null;
  // id phần -> tên phần, để hiện chip "đã chọn" ở bước 1.
  unitTitles: Record<string, string>;
  // id phần -> kỹ năng, để chỉ hiện "Ẩn thanh audio" khi có phần Listening.
  unitSkills: Record<string, string>;
};

const EMPTY_COUNTS: WizardCounts = { units: 0, students: 0 };

// Vỏ modal cho form tạo bài giao. Cả 3 bước nằm trong CÙNG một <form>; bước
// không hiện chỉ bị ẩn bằng class "hidden" nên mọi checkbox vẫn ở trong DOM và
// FormData gửi lên vẫn đủ — tuyệt đối không render có điều kiện từng bước.
export function AssignmentWizard({
  unitStep,
  studentStep,
  settingsLeft,
  settingsRight,
  canCreate,
  disabledReason,
  unitTitles,
  unitSkills
}: AssignmentWizardProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [counts, setCounts] = useState<WizardCounts>(EMPTY_COUNTS);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [titleFilled, setTitleFilled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Chỉ dựng portal sau khi mount ở client (document.body đã sẵn sàng) — tránh
  // lệch nội dung SSR/hydrate giống NoticeToast/SubmitCelebration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Đếm lại số phần / học viên khi có checkbox đổi tick, và cập nhật riêng
  // trạng thái "tiêu đề đã có chữ chưa" khi người dùng gõ. Nghe trên <form>
  // nên không cần nâng state của hai picker lên đây. TÁCH theo loại sự kiện
  // thay vì gọi chung một hàm cho cả hai: "change" → đếm lại phần/học viên
  // (checkbox không bắn "input" thật từ trình duyệt — nút "Chọn tất
  // cả"/chip lớp ở StudentPicker, UnitPickerTest đổi tick bằng React state rồi
  // tự bắn "change" nổi bọt); "input" (gõ tiêu đề, gõ ô tìm đề/tìm học viên,
  // Hướng dẫn, giờ, thời gian kỹ năng...) chỉ đọc lại ô Tiêu đề — KHÔNG chạy
  // lại phép đếm units/students hay tạo mới mảng selectedUnitIds, để mỗi phím
  // gõ không kéo effect data-wizard-when-skill (phụ thuộc selectedUnitIds)
  // chạy lại vô ích.
  useEffect(() => {
    if (!open) {
      return;
    }
    const form = formRef.current;
    if (!form) {
      return;
    }
    const recountSelection = () => {
      const units = Array.from(
        form.querySelectorAll<HTMLInputElement>('input[name="unitIds"]:checked')
      );
      setSelectedUnitIds(units.map((input) => input.value));
      setCounts({
        units: units.length,
        students: form.querySelectorAll('input[name="studentIds"]:checked').length
      });
    };
    const recountTitle = () => {
      const titleInput = form.querySelector<HTMLInputElement>('input[name="title"]');
      // Khớp với zod .trim().min(2) ở server — minLength={2} của trình duyệt
      // vẫn cho qua chuỗi toàn khoảng trắng nên phải tự trim ở đây.
      setTitleFilled(Boolean(titleInput && titleInput.value.trim().length >= 2));
    };
    recountSelection();
    recountTitle();
    form.addEventListener("change", recountSelection);
    form.addEventListener("input", recountTitle);
    return () => {
      form.removeEventListener("change", recountSelection);
      form.removeEventListener("input", recountTitle);
    };
  }, [open]);

  // Khối nào có data-wizard-when-skill chỉ hiện khi kỹ năng đó đang được chọn.
  // Khi ẩn thì bỏ tick luôn để không gửi lên cấu hình thừa.
  useEffect(() => {
    if (!open) {
      return;
    }
    const form = formRef.current;
    if (!form) {
      return;
    }
    const skills = new Set(selectedUnitIds.map((unitId) => unitSkills[unitId]));
    form.querySelectorAll<HTMLElement>("[data-wizard-when-skill]").forEach((node) => {
      const needed = node.dataset.wizardWhenSkill ?? "";
      const visible = skills.has(needed);
      node.hidden = !visible;
      // Đặt thêm class "hidden" y như UnitSearchFilter: khối này hiện chỉ vì
      // <fieldset> không mang class display nào — nếu sau này ai thêm class
      // "flex"/"grid" vào đây, thuộc tính [hidden] ở @layer base sẽ bị đè bởi
      // utility ở layer sau. Giữ cả hai để toàn tính năng chỉ còn một cách ẩn.
      node.classList.toggle("hidden", !visible);
      if (!visible) {
        node
          .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
          .forEach((input) => {
            input.checked = false;
          });
      }
    });
  }, [open, selectedUnitIds, unitSkills]);

  const requestClose = useCallback(() => {
    const dirty = counts.units > 0 || counts.students > 0;
    if (dirty && !window.confirm("Bỏ bài giao đang tạo?")) {
      return;
    }
    setOpen(false);
    setStep(1);
    setCounts(EMPTY_COUNTS);
    setSelectedUnitIds([]);
    triggerRef.current?.focus();
  }, [counts]);

  // requestClose đổi identity mỗi khi counts đổi (tức là mỗi lần tick 1
  // checkbox). Cập nhật ref này mỗi lần render để effect Esc/scroll-lock bên
  // dưới KHÔNG cần đưa requestClose vào dependency array — nếu đưa vào, effect
  // sẽ chạy lại theo mỗi lần tick và panelRef.current?.focus() sẽ cướp focus
  // khỏi checkbox vừa bấm, hỏng thao tác Tab + Space chọn nhiều mục liên tiếp
  // bằng bàn phím. Đọc qua ref vẫn luôn thấy counts mới nhất vì requestClose
  // được tạo lại (và gán vào ref) ngay trong lần render có counts mới.
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  // Esc đóng, khoá cuộn nền, đưa focus vào modal — chỉ phụ thuộc [open] nên
  // chỉ chạy đúng 1 lần khi mở/đóng, không chạy lại theo mỗi lần tick chọn.
  useEffect(() => {
    if (!open) {
      return;
    }
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestCloseRef.current();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Cờ "đang gửi" (và trạng thái đã điền tiêu đề) chỉ có ý nghĩa cho MỘT lần
  // mở modal. Nếu không reset, kịch bản sau kẹt nút vĩnh viễn: bấm "Giao bài",
  // mạng chậm (submitting=true), bấm Esc/✕ đóng modal trước khi server action
  // phản hồi, mở lại modal → submitting vẫn true, nút khoá cứng với nhãn
  // "Đang giao bài…", không có cách nào gỡ ngoài tải lại trang. Đặt thành
  // effect riêng theo [open] (thay vì reset trong requestClose) để chắc chắn
  // chạy với MỌI cách modal đóng, kể cả nếu sau này có thêm đường đóng khác
  // ngoài requestClose. Chỉ set khi open ĐÃ chuyển sang false — không đụng cờ
  // lúc modal còn đang mở, nên không mở khoá nhầm nút giữa lúc server action
  // vẫn đang chạy dở (đúng cái submitting sinh ra để chặn).
  useEffect(() => {
    if (open) {
      return;
    }
    setSubmitting(false);
    setTitleFilled(false);
  }, [open]);

  // Bỏ chọn 1 phần từ chip: bấm vào chính checkbox để React nhận onChange —
  // gán checked trực tiếp sẽ làm DOM lệch với state controlled trong
  // UnitPickerTest.
  function unselectUnit(unitId: string) {
    // CSS.escape phòng khi unitId chứa ký tự đặc biệt với cú pháp selector
    // (hiện luôn là cuid nên an toàn, nhưng escape cho chắc).
    const input = formRef.current?.querySelector<HTMLInputElement>(
      `input[name="unitIds"][value="${CSS.escape(unitId)}"]`
    );
    input?.click();
  }

  const blocker = stepBlocker(step, counts);
  const reachable = maxReachableStep(counts);

  // Lý do khoá nút Giao bài ở bước cuối — chặn TRƯỚC khi submit thay vì để
  // server action từ chối rồi redirect, vì redirect làm modal dựng lại từ đầu
  // và mất sạch lựa chọn (không sửa được ở đây vì không được đụng
  // lib/actions/assignments.ts).
  const submitBlockReason = submitting
    ? null
    : counts.units === 0
      ? "Chọn ít nhất 1 phần"
      : counts.students === 0
        ? "Chọn ít nhất 1 học viên"
        : !titleFilled
          ? "Nhập tiêu đề (tối thiểu 2 ký tự)"
          : null;
  const canSubmit = !submitting && Boolean(counts.units) && Boolean(counts.students) && titleFilled;
  const footerReason = step === 3 ? submitBlockReason : blocker;

  // Overlay + panel — được portal thẳng ra <body> bên dưới (xem biến
  // `overlay`), TÁCH khỏi nút bấm và khỏi vị trí trong cây trang. Chỉ overlay
  // cần portal vì nó là phần tử `fixed inset-0`; nút "+ Tạo bài giao" vẫn nằm
  // nguyên tại chỗ.
  const overlay = open ? (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              requestClose();
            }
          }}
        >
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Tạo bài giao"
            className="flex h-full w-full max-w-[55rem] flex-col overflow-hidden bg-card shadow-card outline-none sm:h-auto sm:max-h-[85vh] sm:rounded-xl"
          >
            <form
              ref={formRef}
              action={createAssignment}
              className="flex min-h-0 flex-1 flex-col"
              onKeyDown={(event) => {
                // Ý định gốc: chặn Enter trong Ô NHẬP VĂN BẢN để nó không
                // submit sớm cả form ở bước 1–2. Enter còn là cách kích hoạt
                // mặc định của <button>/<summary> (và xuống dòng của
                // <textarea>) — preventDefault ở đó sẽ làm bàn phím không bấm
                // được "Tiếp tục", chip lớp, "Chọn tất cả", nút đóng, hay
                // mở/gập cây đề. Chỉ chặn khi target đúng là <input> kiểu nhập
                // văn bản (bỏ qua checkbox/radio); mọi thẻ khác giữ hành vi
                // Enter mặc định.
                if (event.key !== "Enter" || step === 3) {
                  return;
                }
                const target = event.target as HTMLElement;
                if (target.tagName !== "INPUT") {
                  return;
                }
                const inputType = (target as HTMLInputElement).type;
                if (inputType === "checkbox" || inputType === "radio") {
                  return;
                }
                event.preventDefault();
              }}
              onSubmit={() => setSubmitting(true)}
            >
              <div className="border-b border-border px-5 pb-3 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold">Tạo bài giao</h3>
                  <button
                    type="button"
                    onClick={requestClose}
                    aria-label="Đóng"
                    className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground transition hover:border-primary hover:text-primary"
                  >
                    ✕
                  </button>
                </div>

                <ol className="mt-3 flex flex-wrap items-center gap-1.5">
                  {WIZARD_STEPS.map((item) => {
                    const active = item.id === step;
                    const usable = item.id <= reachable;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          disabled={!usable}
                          onClick={() => setStep(item.id)}
                          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
                            active
                              ? "bg-primary/10 font-semibold text-primary"
                              : "text-muted-foreground hover:text-foreground disabled:hover:text-muted-foreground"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          <span
                            className={`flex size-5 items-center justify-center rounded-full text-xs ${
                              active
                                ? "bg-primary text-primary-foreground"
                                : "border border-border"
                            }`}
                          >
                            {item.id}
                          </span>
                          <span className="hidden sm:inline">{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                  <li className="ml-1 text-xs text-muted-foreground sm:hidden">
                    Bước {step}/3 · {WIZARD_STEPS[step - 1].label}
                  </li>
                </ol>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 px-5 py-4">
                <div data-wizard-step="1" className={step === 1 ? "" : "hidden"}>
                  {selectedUnitIds.length > 0 ? (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {selectedUnitIds.map((unitId) => (
                        <span
                          key={unitId}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs"
                        >
                          {unitTitles[unitId] ?? "Phần đã chọn"}
                          <button
                            type="button"
                            aria-label={`Bỏ chọn ${unitTitles[unitId] ?? "phần này"}`}
                            onClick={() => unselectUnit(unitId)}
                            className="text-muted-foreground transition hover:text-red-500"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {unitStep}
                </div>
                <div data-wizard-step="2" className={step === 2 ? "" : "hidden"}>
                  {studentStep}
                </div>
                <div data-wizard-step="3" className={step === 3 ? "" : "hidden"}>
                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="space-y-4">{settingsLeft}</div>
                    <div className="space-y-4">
                      {settingsRight}
                      <div className="rounded-lg border border-border bg-background p-3">
                        <p className="text-sm font-semibold">Sẽ giao</p>
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {selectedUnitIds.map((unitId) => (
                            <li key={unitId}>· {unitTitles[unitId] ?? "Phần đã chọn"}</li>
                          ))}
                        </ul>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Cho {counts.students} học viên
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
                <span className="text-xs text-muted-foreground">{summaryLabel(counts)}</span>
                <div className="flex items-center gap-2">
                  {footerReason ? (
                    <span className="text-xs text-amber-600 dark:text-amber-300">
                      {footerReason}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    disabled={step === 1}
                    onClick={() => setStep((current) => (current > 1 ? ((current - 1) as WizardStep) : current))}
                    className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Quay lại
                  </button>
                  {step === 3 ? (
                    <button
                      disabled={!canSubmit}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting ? "Đang giao bài…" : submitLabel(counts)}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={Boolean(blocker)}
                      onClick={() => setStep((current) => ((current + 1) as WizardStep))}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Tiếp tục
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        disabled={!canCreate}
        title={disabledReason ?? undefined}
        className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        + Tạo bài giao
      </button>
      {disabledReason ? (
        <span className="text-xs text-muted-foreground">{disabledReason}</span>
      ) : null}
      {/*
        Portal overlay ra document.body: AppShell (components/app-shell.tsx)
        bọc nội dung trang trong một div có class "animate-fade-in"
        (tailwind.config.ts), keyframe cuối là `transform: translateY(0)`. Một
        phần tử có `transform` khác `none` trở thành CONTAINING BLOCK cho mọi
        con `position: fixed` bên trong nó — nghĩa là overlay `fixed inset-0`
        của modal này sẽ neo theo chiều cao của div đó (toàn bộ nội dung trang)
        chứ không phải theo viewport. Ở trang có nhiều bài đã giao (nội dung
        cao hơn màn hình), `sm:items-center` sẽ canh modal ra giữa TRANG, tít
        dưới khu vực đang xem, trong khi overflow:hidden trên body chặn cuộn
        xuống đó — giáo viên bấm "+ Tạo bài giao" chỉ thấy nền tối, không thấy
        hộp thoại. NoticeToast và SubmitCelebration đã dính đúng lỗi này —
        portal ra <body> là cách sửa đã được xác nhận, ĐỪNG "dọn cho gọn" bằng
        cách bỏ portal.
      */}
      {mounted && overlay ? createPortal(overlay, document.body) : null}
    </>
  );
}
