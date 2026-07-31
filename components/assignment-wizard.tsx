"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  disabledReason
}: AssignmentWizardProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [counts, setCounts] = useState<WizardCounts>(EMPTY_COUNTS);
  const formRef = useRef<HTMLFormElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Đếm lại số phần / học viên mỗi khi có ô nào đổi trạng thái tick. Nghe trên
  // <form> nên không cần nâng state của hai picker lên đây.
  useEffect(() => {
    if (!open) {
      return;
    }
    const form = formRef.current;
    if (!form) {
      return;
    }
    const recount = () => {
      setCounts({
        units: form.querySelectorAll('input[name="unitIds"]:checked').length,
        students: form.querySelectorAll('input[name="studentIds"]:checked').length
      });
    };
    recount();
    form.addEventListener("change", recount);
    return () => form.removeEventListener("change", recount);
  }, [open]);

  const requestClose = useCallback(() => {
    const dirty = counts.units > 0 || counts.students > 0;
    if (dirty && !window.confirm("Bỏ bài giao đang tạo?")) {
      return;
    }
    setOpen(false);
    setStep(1);
    setCounts(EMPTY_COUNTS);
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

  const blocker = stepBlocker(step, counts);
  const reachable = maxReachableStep(counts);

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

      {open ? (
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
                // Enter ở bước 1–2 sẽ submit sớm cả form → chặn lại.
                if (event.key !== "Enter" || step === 3) {
                  return;
                }
                if ((event.target as HTMLElement).tagName === "TEXTAREA") {
                  return;
                }
                event.preventDefault();
              }}
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
                  {unitStep}
                </div>
                <div data-wizard-step="2" className={step === 2 ? "" : "hidden"}>
                  {studentStep}
                </div>
                <div data-wizard-step="3" className={step === 3 ? "" : "hidden"}>
                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="space-y-4">{settingsLeft}</div>
                    <div className="space-y-4">{settingsRight}</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
                <span className="text-xs text-muted-foreground">{summaryLabel(counts)}</span>
                <div className="flex items-center gap-2">
                  {blocker ? (
                    <span className="text-xs text-amber-600 dark:text-amber-300">{blocker}</span>
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
                    <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">
                      {submitLabel(counts)}
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
      ) : null}
    </>
  );
}
