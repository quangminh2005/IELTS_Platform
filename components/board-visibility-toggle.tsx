import { ActionForm, ActionSubmitButton } from "@/components/action-form";
import { setHiddenFromBoards } from "@/lib/actions/profile";

// Công tắc ở trang học viên phía thầy: ẩn tài khoản thử khỏi mọi bảng xếp hạng
// (Học Bá, Chuỗi, Điểm lớp, Tổng kết tháng) và khỏi xét thưởng Xu tháng.
export function BoardVisibilityToggle({ studentId, hidden }: { studentId: string; hidden: boolean }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-card">
      <ActionForm action={setHiddenFromBoards} className="flex flex-wrap items-center justify-between gap-3">
        <input type="hidden" name="studentId" value={studentId} />
        <input type="hidden" name="hidden" value={hidden ? "0" : "1"} />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Bảng xếp hạng</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {hidden
              ? "Đang ẩn — học viên này không hiện trên bảng xếp hạng và không được xét thưởng Xu tháng."
              : "Đang hiện trên bảng xếp hạng. Ẩn nếu đây là tài khoản thử."}
          </p>
        </div>
        <ActionSubmitButton
          pendingLabel="Đang lưu…"
          className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            hidden
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "border border-border hover:bg-muted"
          }`}
        >
          {hidden ? "Hiện lại trên bảng" : "Ẩn khỏi bảng xếp hạng"}
        </ActionSubmitButton>
      </ActionForm>
    </section>
  );
}
