"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { parseEventKey } from "@/lib/feed";
import { canDeleteComment, findFeedEvent, getComments, type FeedCommentView } from "@/lib/feed-data";
import { containsProfanity } from "@/lib/feed-moderation";
import { requireFeedUser } from "@/lib/feed-user";
import { prisma } from "@/lib/prisma";
import { vietnamDateKey } from "@/lib/vocab-day";

// Tim + bình luận bảng tin (Mạng xã hội Đợt 3, spec 2026-10-06-xa-hoi-dot-3).
// Cả học viên lẫn thầy dùng được; người làm LUÔN lấy từ phiên đăng nhập. eventKey phải
// có thật trong bảng tin (14 ngày, không phải tài khoản ẩn) — không gắn được vào mã bịa.
// Không cộng Xu/XP.

const COMMENT_MAX = 200;
const COMMENT_DAILY_LIMIT = 30;

const keySchema = z.string().trim().min(3).max(200);
const bodySchema = z.string().trim().min(1, "Bình luận trống.").max(COMMENT_MAX, `Tối đa ${COMMENT_MAX} ký tự.`);
const idSchema = z.string().trim().min(1).max(64);

function isDuplicate(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function revalidateFeed() {
  revalidatePath("/student/feed");
  revalidatePath("/teacher/feed");
}

// Đầu ngày hôm nay theo giờ VN.
function startOfVietnamDay(now: Date): Date {
  return new Date(`${vietnamDateKey(now)}T00:00:00+07:00`);
}

export type HeartResult = ActionResult & { hearted?: boolean };

export async function toggleHeart(rawKey: string): Promise<HeartResult> {
  const viewer = await requireFeedUser();

  try {
    const eventKey = keySchema.parse(rawKey);
    const event = await findFeedEvent(eventKey);
    if (!event) {
      return { ok: false, message: "Hoạt động này đã cũ hoặc không còn." };
    }
    if (viewer.studentId === event.studentId) {
      return { ok: false, message: "Không tự thả tim hoạt động của mình." };
    }

    const where = { eventKey_userId: { eventKey, userId: viewer.userId } };
    const existing = await prisma.feedHeart.findUnique({ where, select: { eventKey: true } });

    let hearted: boolean;
    if (existing) {
      await prisma.feedHeart.deleteMany({ where: { eventKey, userId: viewer.userId } });
      hearted = false;
    } else {
      try {
        await prisma.feedHeart.create({ data: { eventKey, userId: viewer.userId } });
      } catch (error) {
        if (!isDuplicate(error)) throw error;
      }
      hearted = true;
    }

    revalidateFeed();
    return { ...actionOk(hearted ? "Đã thả tim." : "Đã bỏ tim."), hearted };
  } catch (error) {
    return actionFail(error, "Thả tim");
  }
}

export type CommentResult = ActionResult & { comment?: FeedCommentView };

export async function addComment(rawKey: string, rawBody: string): Promise<CommentResult> {
  const viewer = await requireFeedUser();

  try {
    const eventKey = keySchema.parse(rawKey);
    const parsedBody = bodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return { ok: false, message: parsedBody.error.issues[0]?.message ?? "Bình luận không hợp lệ." };
    }
    const body = parsedBody.data;

    const event = await findFeedEvent(eventKey);
    const parsedKey = parseEventKey(eventKey);
    if (!event || !parsedKey) {
      return { ok: false, message: "Hoạt động này đã cũ hoặc không còn." };
    }
    if (containsProfanity(body)) {
      return { ok: false, message: "Bình luận có từ không phù hợp." };
    }

    const now = new Date();
    if (viewer.role === "student") {
      const today = await prisma.feedComment.count({
        where: { authorUserId: viewer.userId, createdAt: { gte: startOfVietnamDay(now) } }
      });
      if (today >= COMMENT_DAILY_LIMIT) {
        return { ok: false, message: `Hôm nay bạn đã bình luận ${COMMENT_DAILY_LIMIT} lần — mai tiếp nhé.` };
      }
    }

    const created = await prisma.feedComment.create({
      data: { eventKey, ownerStudentId: parsedKey.studentId, authorUserId: viewer.userId, body },
      select: { id: true }
    });

    revalidateFeed();
    const comments = await getComments(eventKey, viewer);
    return { ...actionOk("Đã gửi bình luận."), comment: comments.find((comment) => comment.id === created.id) };
  } catch (error) {
    return actionFail(error, "Bình luận");
  }
}

export async function deleteComment(rawId: string): Promise<ActionResult> {
  const viewer = await requireFeedUser();

  try {
    const id = idSchema.parse(rawId);
    const comment = await prisma.feedComment.findUnique({
      where: { id },
      select: { authorUserId: true, ownerStudentId: true }
    });
    if (!comment) {
      return actionOk("Bình luận đã được xoá.");
    }
    if (!canDeleteComment(viewer, comment)) {
      return { ok: false, message: "Bạn không có quyền xoá bình luận này." };
    }

    await prisma.feedComment.deleteMany({ where: { id } });
    revalidateFeed();
    return actionOk(viewer.role === "teacher" ? "Đã gỡ bình luận." : "Đã xoá bình luận.");
  } catch (error) {
    return actionFail(error, "Xoá bình luận");
  }
}

// Mở phần bình luận dưới một hoạt động.
export async function listComments(rawKey: string): Promise<ActionResult & { comments?: FeedCommentView[] }> {
  const viewer = await requireFeedUser();

  try {
    const eventKey = keySchema.parse(rawKey);
    return { ...actionOk(""), comments: await getComments(eventKey, viewer) };
  } catch (error) {
    return actionFail(error, "Tải bình luận");
  }
}
