"use client";

import { ActionForm } from "@/components/action-form";
import { createCommentSnippet, deleteCommentSnippet } from "@/lib/actions/comment-snippets";

export type Snippet = {
  id: string;
  text: string;
};

// Ngân hàng nhận xét tách làm HAI phần vì lý do kỹ thuật: phần thêm/xoá câu mẫu
// cần <form> riêng, mà HTML không cho lồng form trong form. Nên phần bấm-để-chèn
// (chỉ là nút thường) nằm TRONG phiếu chấm, ngay dưới ô "Nhận xét chi tiết";
// còn phần quản lý nằm NGOÀI phiếu chấm, thu gọn lại.

export function CommentBankChips({
  snippets,
  onInsert
}: {
  snippets: Snippet[];
  onInsert: (text: string) => void;
}) {
  if (snippets.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Chưa có câu mẫu nào. Thêm ở mục “Quản lý câu mẫu” bên dưới để lần sau chèn nhanh.
      </p>
    );
  }

  return (
    <div className="grid gap-1.5">
      <p className="text-xs text-muted-foreground">Bấm một câu để chèn vào ô trên:</p>
      <div className="flex flex-wrap gap-1.5">
        {snippets.map((snippet) => (
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
  );
}

export function CommentBankManager({
  snippets,
  attemptId
}: {
  snippets: Snippet[];
  attemptId: string;
}) {
  return (
    <details className="rounded-lg border border-border bg-muted/30 p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Quản lý câu mẫu{snippets.length > 0 ? ` (${snippets.length})` : ""}
      </summary>

      <p className="mt-2 text-xs text-muted-foreground">
        Những câu hay dùng khi chấm. Lưu ở đây rồi bấm để chèn vào “Nhận xét chi tiết”.
      </p>

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

      <ActionForm action={createCommentSnippet} className="mt-3 flex gap-2">
        <input type="hidden" name="attemptId" value={attemptId} />
        <input
          name="text"
          required
          placeholder="Thêm câu nhận xét mẫu…"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          Thêm
        </button>
      </ActionForm>
    </details>
  );
}
