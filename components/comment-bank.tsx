"use client";

import { createCommentSnippet, deleteCommentSnippet } from "@/lib/actions/comment-snippets";

export type Snippet = {
  id: string;
  text: string;
};

type CommentBankProps = {
  snippets: Snippet[];
  attemptId: string;
  onInsert: (text: string) => void;
};

export function CommentBank({ snippets, attemptId, onInsert }: CommentBankProps) {
  return (
    <section className="rounded-lg border border-border bg-muted/30 p-4">
      <h4 className="text-sm font-semibold">Ngân hàng nhận xét</h4>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Click một câu để chèn vào ô &quot;Nhận xét chi tiết&quot;.
      </p>

      {snippets.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {snippets.map((snippet) => (
            <li key={snippet.id} className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => onInsert(snippet.text)}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-left text-sm leading-6 transition hover:border-primary"
              >
                {snippet.text}
              </button>
              <form action={deleteCommentSnippet}>
                <input type="hidden" name="snippetId" value={snippet.id} />
                <input type="hidden" name="attemptId" value={attemptId} />
                <button
                  type="submit"
                  aria-label="Xoá câu mẫu"
                  className="rounded-md border border-border px-2.5 py-2 text-sm text-muted-foreground transition hover:border-red-400 hover:text-red-500"
                >
                  ✕
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Chưa có câu mẫu nào. Thêm những câu hay dùng để chèn nhanh khi chấm.
        </p>
      )}

      <form action={createCommentSnippet} className="mt-3 flex gap-2">
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
      </form>
    </section>
  );
}
