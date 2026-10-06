"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { requireStudent } from "@/lib/actions/attempts";
import { prisma } from "@/lib/prisma";
import { vietnamDateKey } from "@/lib/vocab-day";

// Theo dõi bạn bè + thả cảm xúc (Mạng xã hội Đợt 2, spec 2026-10-06-xa-hoi-dot-2).
// Người theo dõi / người gửi LUÔN là học viên đang đăng nhập — không bao giờ lấy từ
// tham số. Cảm xúc không cộng Xu/XP (thầy chốt 6/10/2026: tránh rủ nhau bấm cày Xu).

const targetSchema = z.string().trim().min(1).max(64);
const kindSchema = z.enum(["cheer", "fire", "target"]);

// Bấm hai lần liền tay → request thứ hai đụng khoá trùng. Coi như đã xong.
function isDuplicate(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function revalidateSocial(targetId: string) {
  revalidatePath(`/student/profile/${targetId}`);
  revalidatePath("/student/profile");
  revalidatePath("/student/ranking");
}

export type FollowResult = ActionResult & { following?: boolean };

// Đang theo dõi → bỏ theo dõi; chưa → theo dõi. Trả trạng thái mới để nút cập nhật.
export async function toggleFollow(rawTargetId: string): Promise<FollowResult> {
  const student = await requireStudent();

  try {
    const targetId = targetSchema.parse(rawTargetId);
    if (targetId === student.id) {
      return { ok: false, message: "Bạn không thể tự theo dõi chính mình." };
    }

    const target = await prisma.studentProfile.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!target) {
      return { ok: false, message: "Không tìm thấy học viên này." };
    }

    const key = { followerId: student.id, followingId: targetId };
    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: key },
      select: { followerId: true }
    });

    let following: boolean;
    if (existing) {
      await prisma.follow.deleteMany({ where: key });
      following = false;
    } else {
      try {
        await prisma.follow.create({ data: key });
      } catch (error) {
        if (!isDuplicate(error)) throw error;
      }
      following = true;
    }

    revalidateSocial(targetId);
    return { ...actionOk(following ? "Đã theo dõi." : "Đã bỏ theo dõi."), following };
  } catch (error) {
    return actionFail(error, "Theo dõi");
  }
}

// Mỗi loại 1 lần/ngày/người — ràng buộc unique (fromId, toId, kind, dayKey) giữ luật.
export async function sendReaction(rawTargetId: string, rawKind: string): Promise<ActionResult> {
  const student = await requireStudent();

  try {
    const targetId = targetSchema.parse(rawTargetId);
    const kind = kindSchema.parse(rawKind);
    if (targetId === student.id) {
      return { ok: false, message: "Bạn không thể tự gửi cảm xúc cho chính mình." };
    }

    const target = await prisma.studentProfile.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!target) {
      return { ok: false, message: "Không tìm thấy học viên này." };
    }

    try {
      await prisma.profileReaction.create({
        data: { fromId: student.id, toId: targetId, kind, dayKey: vietnamDateKey(new Date()) }
      });
    } catch (error) {
      if (!isDuplicate(error)) throw error;
    }

    revalidatePath(`/student/profile/${targetId}`);
    return actionOk("Đã gửi.");
  } catch (error) {
    return actionFail(error, "Gửi cảm xúc");
  }
}
