"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { StudentAvatar } from "@/components/student-avatar";
import { useToast } from "@/components/toast";
import { addComment, deleteComment, listComments, toggleHeart } from "@/lib/actions/feed";
import type { FeedCommentView, FeedItemView } from "@/lib/feed-data";
import { formatRelativeTime } from "@/lib/notifications";

// Thẻ một hoạt động trên bảng tin (Mạng xã hội Đợt 3): ❤️ tim + 💬 bình luận một tầng.
// Dùng chung cho trang học viên và trang thầy.

const COMMENT_MAX = 200;
const NETWORK_FAIL = { ok: false, message: "Không kết nối được, thử lại sau nhé." };

export type FeedViewer = { role: "teacher" | "student"; studentId: string | null };

function TeacherBadge() {
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground"
    >
      GV
    </span>
  );
}

function CommentRow({
  comment,
  onDelete,
  deleting
}: {
  comment: FeedCommentView;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  return (
    <li className="flex gap-2.5">
      {comment.authorPerson ? (
        <StudentAvatar
          avatarUrl={comment.authorPerson.avatarUrl}
          avatarPreset={comment.authorPerson.avatarPreset}
          userImage={comment.authorPerson.userImage}
          frame={comment.authorPerson.equippedFrame ?? null}
          displayName={comment.authorPerson.displayName}
          size="sm"
        />
      ) : (
        <TeacherBadge />
      )}
      <div className="min-w-0 flex-1 rounded-xl bg-border/30 px-3 py-2 dark:bg-border/20">
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs">
          <span className="font-semibold text-foreground">{comment.authorName}</span>
          {comment.authorIsTeacher ? (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              Giáo viên
            </span>
          ) : null}
          <span className="text-muted-foreground" suppressHydrationWarning>
            · {formatRelativeTime(new Date(comment.at))}
          </span>
        </p>
        {/* Văn bản thuần do người dùng nhập — không bao giờ render HTML. */}
        <p className="mt-0.5 whitespace-pre-line break-words text-sm">{comment.body}</p>
      </div>
      {comment.canDelete ? (
        <button
          type="button"
          onClick={() => onDelete(comment.id)}
          disabled={deleting}
          className="self-start text-xs text-muted-foreground transition hover:text-red-600 disabled:opacity-50"
        >
          Xoá
        </button>
      ) : null}
    </li>
  );
}

export function FeedCard({
  item,
  viewer,
  ownerHref,
  initiallyOpen = false
}: {
  item: FeedItemView;
  viewer: FeedViewer;
  ownerHref: string;
  initiallyOpen?: boolean;
}) {
  const { notify } = useToast();
  const [hearted, setHearted] = useState(item.hearted);
  const [hearts, setHearts] = useState(item.hearts);
  const [commentCount, setCommentCount] = useState(item.comments);
  // open = đang mở ô viết bình luận. Bình luận đã có thì luôn hiện (bản xem trước từ server).
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<FeedCommentView[]>(item.previewComments);
  // complete = đã có đủ mọi bình luận (không còn cái cũ nào chưa tải)
  const [complete, setComplete] = useState(item.previewComments.length >= item.comments);
  const [loadingComments, setLoadingComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, startTransition] = useTransition();
  const isOwn = viewer.studentId === item.owner.studentId;

  function loadComments() {
    setLoadingComments(true);
    startTransition(async () => {
      try {
        const result = await listComments(item.key);
        if (result.ok && result.comments) {
          setComments(result.comments);
          setCommentCount(result.comments.length);
          setComplete(true);
        } else {
          notify(result);
        }
      } catch {
        notify(NETWORK_FAIL);
      } finally {
        setLoadingComments(false);
      }
    });
  }

  // Mở sẵn bình luận khi đến từ chuông (?focus=…) — một lần sau khi gắn vào trang.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (!initiallyOpen || autoOpened.current) return;
    autoOpened.current = true;
    setOpen(true);
    loadComments();
    // loadComments đọc item.key cố định của thẻ — chỉ cần chạy một lần.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initiallyOpen]);

  function handleHeart() {
    if (isOwn) return;
    const previous = hearted;
    setHearted(!previous);
    setHearts((value) => Math.max(0, value + (previous ? -1 : 1)));

    startTransition(async () => {
      try {
        const result = await toggleHeart(item.key);
        if (!result.ok) {
          setHearted(previous);
          setHearts((value) => Math.max(0, value + (previous ? 1 : -1)));
          notify(result);
        }
      } catch {
        setHearted(previous);
        setHearts((value) => Math.max(0, value + (previous ? 1 : -1)));
        notify(NETWORK_FAIL);
      }
    });
  }

  function toggleComments() {
    const next = !open;
    setOpen(next);
    if (next && !complete) loadComments();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;

    startTransition(async () => {
      try {
        const result = await addComment(item.key, body);
        if (result.ok && result.comment) {
          const added = result.comment;
          setComments((list) => [...list, added]);
          setCommentCount((value) => value + 1);
          setDraft("");
        } else {
          notify(result);
        }
      } catch {
        notify(NETWORK_FAIL);
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        const result = await deleteComment(id);
        if (result.ok) {
          setComments((list) => list.filter((comment) => comment.id !== id));
          setCommentCount((value) => Math.max(0, value - 1));
        }
        notify(result);
      } catch {
        notify(NETWORK_FAIL);
      }
    });
  }

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <StudentAvatar
          avatarUrl={item.owner.avatarUrl}
          avatarPreset={item.owner.avatarPreset}
          userImage={item.owner.userImage}
          frame={item.owner.equippedFrame ?? null}
          displayName={item.owner.displayName}
          size="list"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug">
            <Link href={ownerHref} className="font-semibold hover:text-primary hover:underline">
              {item.owner.displayName}
            </Link>{" "}
            <span className="text-foreground/90">{item.text}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground" suppressHydrationWarning>
            <span aria-hidden="true">{item.emoji} </span>
            {formatRelativeTime(new Date(item.at))}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-border pt-2">
        <button
          type="button"
          onClick={handleHeart}
          disabled={isOwn}
          aria-pressed={hearted}
          aria-label={`${isOwn ? "Lượt tim" : hearted ? "Bỏ tim" : "Thả tim"} (${hearts})`}
          title={isOwn ? "Hoạt động của bạn" : hearted ? "Bỏ tim" : "Thả tim"}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition ${
            hearted ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground hover:bg-border/40"
          } disabled:cursor-default disabled:hover:bg-transparent`}
        >
          <span aria-hidden="true">{hearted ? "❤️" : "🤍"}</span>
          <span className="tabular-nums">{hearts}</span>
        </button>
        <button
          type="button"
          onClick={toggleComments}
          aria-expanded={open}
          aria-label={`Bình luận (${commentCount})`}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-border/40"
        >
          <span aria-hidden="true">💬</span>
          <span className="tabular-nums">{commentCount}</span>
        </button>
      </div>

      {open || comments.length > 0 ? (
        <div className="mt-2 space-y-3">
          {!complete && commentCount > comments.length ? (
            <button
              type="button"
              onClick={loadComments}
              disabled={loadingComments}
              className="text-xs font-semibold text-muted-foreground transition hover:text-primary disabled:opacity-50"
            >
              {loadingComments ? "Đang tải…" : `Xem ${commentCount - comments.length} bình luận trước`}
            </button>
          ) : null}

          {comments.length > 0 ? (
            <ul className="space-y-2">
              {comments.map((comment) => (
                <CommentRow key={comment.id} comment={comment} onDelete={handleDelete} deleting={busy} />
              ))}
            </ul>
          ) : complete ? (
            <p className="text-sm text-muted-foreground">Chưa có bình luận — mở lời đầu tiên nhé!</p>
          ) : null}

          {open ? (
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Viết bình luận</span>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value.slice(0, COMMENT_MAX))}
                  maxLength={COMMENT_MAX}
                  rows={1}
                  placeholder="Viết bình luận…"
                  // 16px trên điện thoại để iOS không tự phóng to khi chạm vào ô.
                  className="block w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-base outline-none transition focus:border-primary sm:text-sm"
                />
                <span className="mt-0.5 block text-right text-[11px] tabular-nums text-muted-foreground">
                  {draft.length}/{COMMENT_MAX}
                </span>
              </label>
              <button
                type="submit"
                disabled={busy || draft.trim().length === 0}
                className="mb-5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Gửi
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
