import Link from "next/link";
import { FeedCard } from "@/components/feed/feed-card";
import { TeacherCommentList } from "@/components/feed/teacher-comment-list";
import { FEED_PAGE_SIZE, FEED_WINDOW_DAYS, resolveFeedLimit } from "@/lib/feed";
import { getFeedPage, getRecentComments } from "@/lib/feed-data";
import { requireTeacherPage } from "@/lib/teacher-page";

export const dynamic = "force-dynamic";

// Bảng tin phía thầy (Mạng xã hội Đợt 3): tab Bảng tin (toàn trường — thầy tim và
// bình luận được, có nhãn Giáo viên) + tab Bình luận mới để gỡ.

const RECENT_COMMENT_LIMIT = 50;

function tabClass(active: boolean): string {
  return `rounded-lg px-4 py-2 text-center text-sm font-semibold transition ${
    active ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
  }`;
}

export default async function TeacherFeedPage({
  searchParams
}: {
  searchParams?: { tab?: string; limit?: string };
}) {
  const teacher = await requireTeacherPage();
  const tab = searchParams?.tab === "comments" ? "comments" : "feed";
  const limit = resolveFeedLimit(searchParams?.limit);

  let body: JSX.Element;
  if (tab === "comments") {
    body = <TeacherCommentList comments={await getRecentComments(RECENT_COMMENT_LIMIT)} />;
  } else {
    const page = await getFeedPage({
      viewer: { userId: teacher.userId, role: "teacher", studentId: null },
      studentIds: null,
      limit
    });
    body = (
      <>
        {page.items.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-5 py-12 text-center text-sm text-muted-foreground shadow-card">
            Chưa có hoạt động nào trong {FEED_WINDOW_DAYS} ngày qua.
          </div>
        ) : null}
        {page.items.map((item) => (
          <FeedCard
            key={item.key}
            item={item}
            viewer={{ role: "teacher", studentId: null }}
            ownerHref={`/teacher/students/${item.owner.studentId}`}
          />
        ))}
        {page.hasMore ? (
          <div className="text-center">
            <Link
              href={`/teacher/feed?limit=${limit + FEED_PAGE_SIZE}`}
              scroll={false}
              className="inline-block rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold shadow-card transition hover:border-primary"
            >
              Xem thêm
            </Link>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Mạng xã hội</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Bảng tin</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Hoạt động của học viên trong {FEED_WINDOW_DAYS} ngày gần đây. Lời khen của thầy hiện kèm nhãn Giáo viên;
          bình luận không phù hợp thì gỡ ở tab Bình luận mới.
        </p>
      </header>

      <div className="mx-auto max-w-2xl space-y-4">
        <nav aria-label="Bảng tin" className="inline-flex rounded-xl border border-border bg-border/30 p-1 dark:bg-border/20">
          <Link href="/teacher/feed" className={tabClass(tab === "feed")}>
            Bảng tin
          </Link>
          <Link href="/teacher/feed?tab=comments" className={tabClass(tab === "comments")}>
            Bình luận mới
          </Link>
        </nav>
        {body}
      </div>
    </div>
  );
}
