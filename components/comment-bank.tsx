"use client";

import { ActionForm } from "@/components/action-form";
import {
  createCommentSnippet,
  deleteCommentSnippet,
  seedDefaultCommentSnippets
} from "@/lib/actions/comment-snippets";
import type { Criterion } from "@/lib/writing-review";

export type Snippet = {
  id: string;
  text: string;
  criterion: string | null;
};

// Ngân hàng nhận xét tách làm HAI phần vì lý do kỹ thuật: phần thêm/xoá câu mẫu
// cần <form> riêng, mà HTML không cho lồng form trong form. Nên phần bấm-để-chèn
// (chỉ là nút thường) nằm TRONG phiếu chấm, ngay dưới ô "Nhận xét chi tiết";
// còn phần quản lý nằm NGOÀI phiếu chấm, thu gọn lại.

// Gom câu mẫu theo tiêu chí, giữ đúng thứ tự 4 tiêu chí đang chấm rồi tới nhóm
// "chung". Câu gắn tiêu chí của kỹ năng khác (vd Speaking khi đang chấm Writing)
// dồn vào nhóm chung để không mất.
function groupSnippets(snippets: Snippet[], criteria: Criterion[]) {
  const known = new Set(criteria.map((criterion) => criterion.key));
  const groups = criteria.map((criterion) => ({
    key: criterion.key,
    label: criterion.label,
    items: snippets.filter((snippet) => snippet.criterion === criterion.key)
  }));

  const general = snippets.filter(
    (snippet) => !snippet.criterion || !known.has(snippet.criterion)
  );

  if (general.length > 0) {
    groups.push({ key: "__general", label: "Nhận xét chung", items: general });
  }

  return groups.filter((group) => group.items.length > 0);
}

export function CommentBankChips({
  snippets,
  criteria,
  onInsert
}: {
  snippets: Snippet[];
  criteria: Criterion[];
  onInsert: (text: string) => void;
}) {
  if (snippets.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Chưa có câu mẫu nào — mở “Quản lý câu mẫu” bên dưới để nạp bộ gợi ý.
      </p>
    );
  }

  const groups = groupSnippets(snippets, criteria);

  return (
    <div className="grid gap-2">
      <p className="text-xs text-muted-foreground">Bấm một câu để chèn vào ô trên:</p>
      {groups.map((group) => (
        <div key={group.key} className="grid gap-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {group.items.map((snippet) => (
              <button
                key={snippet.id}
                type="button"
                onClick={() => onInsert(snippet.text)}
                title={snippet.text}
                className="max-w-full truncate rounded-full border border-border bg-card px-2.5 py-1 text-xs transition hover:border-primary hover:text-primary"
              >
                {snippet.text}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CommentBankManager({
  snippets,
  criteria,
  attemptId
}: {
  snippets: Snippet[];
  criteria: Criterion[];
  attemptId: string;
}) {
  return (
    <details className="rounded-lg border border-border bg-muted/30 p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Quản lý câu mẫu{snippets.length > 0 ? ` (${snippets.length})` : ""}
      </summary>

      <p className="mt-2 text-xs text-muted-foreground">
        Những câu hay dùng khi chấm. Gắn tiêu chí để lúc chấm chúng được xếp đúng nhóm.
      </p>

      <ActionForm action={seedDefaultCommentSnippets} className="mt-3">
        <input type="hidden" name="attemptId" value={attemptId} />
        <button
          type="submit"
          className="rounded-md border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground"
        >
          + Nạp bộ câu mẫu gợi ý
        </button>
      </ActionForm>

      {snippets.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {snippets.map((snippet) => (
            <li key={snippet.id} className="flex items-start gap-2">
              <span className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm leading-6">
                {snippet.text}
              </span>
              <ActionForm action={deleteCommentSnippet}>
                <input type="hidden" name="snippetId" value={snippet.id} />
                <input type="hidden" name="attemptId" value={attemptId} />
                <button
                  type="submit"
                  aria-label="Xoá câu mẫu"
                  className="rounded-md border border-border px-2.5 py-2 text-sm text-muted-foreground transition hover:border-red-400 hover:text-red-500"
                >
                  ✕
                </button>
              </ActionForm>
            </li>
          ))}
        </ul>
      ) : null}

      <ActionForm action={createCommentSnippet} className="mt-3 grid gap-2">
        <input type="hidden" name="attemptId" value={attemptId} />
        <input
          name="text"
          required
          placeholder="Thêm câu nhận xét mẫu…"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
        />
        <div className="flex gap-2">
          <select
            name="criterion"
            defaultValue=""
            aria-label="Tiêu chí của câu mẫu"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
          >
            <option value="">Nhận xét chung</option>
            {criteria.map((criterion) => (
              <option key={criterion.key} value={criterion.key}>
                {criterion.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Thêm
          </button>
        </div>
      </ActionForm>
    </details>
  );
}
