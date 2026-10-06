"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { sendReaction } from "@/lib/actions/social";
import { REACTIONS, type ReactionKind } from "@/lib/social";

const countFormat = new Intl.NumberFormat("vi-VN");
const NETWORK_FAIL = { ok: false, message: "Không kết nối được, thử lại sau nhé." };

// 3 nút cảm xúc 👏 🔥 🎯 trên hồ sơ (Mạng xã hội Đợt 2). Mỗi loại gửi được 1 lần/ngày
// cho mỗi bạn — đã gửi hôm nay thì nút sáng và khoá tới mai. targetId null = hồ sơ
// của mình: chỉ hiện số đã nhận, không bấm được.
export function ReactionBar({
  targetId,
  totals,
  sentToday
}: {
  targetId: string | null;
  totals: Record<ReactionKind, number>;
  sentToday: ReactionKind[];
}) {
  const [counts, setCounts] = useState(totals);
  const [sent, setSent] = useState<ReactionKind[]>(sentToday);
  const [popping, setPopping] = useState<ReactionKind | null>(null);
  const [, startTransition] = useTransition();
  const { notify } = useToast();

  function undo(kind: ReactionKind) {
    setSent((list) => list.filter((item) => item !== kind));
    setCounts((value) => ({ ...value, [kind]: Math.max(0, value[kind] - 1) }));
  }

  function handleClick(kind: ReactionKind) {
    if (!targetId || sent.includes(kind)) return;

    setSent((list) => [...list, kind]);
    setCounts((value) => ({ ...value, [kind]: value[kind] + 1 }));
    setPopping(kind);
    window.setTimeout(() => setPopping((current) => (current === kind ? null : current)), 500);

    startTransition(async () => {
      try {
        const result = await sendReaction(targetId, kind);
        if (!result.ok) {
          undo(kind);
          notify(result);
        }
      } catch {
        undo(kind);
        notify(NETWORK_FAIL);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {REACTIONS.map((reaction) => {
        const done = sent.includes(reaction.kind);
        const count = countFormat.format(counts[reaction.kind]);

        if (!targetId) {
          return (
            <span
              key={reaction.kind}
              title={reaction.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm"
            >
              <span aria-hidden="true">{reaction.emoji}</span>
              <span className="text-muted-foreground">{reaction.label}</span>
              <span className="font-semibold tabular-nums">{count}</span>
            </span>
          );
        }

        return (
          <button
            key={reaction.kind}
            type="button"
            onClick={() => handleClick(reaction.kind)}
            disabled={done}
            aria-pressed={done}
            title={done ? "Mai bạn gửi tiếp được nhé" : `Gửi ${reaction.label}`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
              done
                ? "cursor-default border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card hover:border-primary hover:bg-primary/5"
            }`}
          >
            <span aria-hidden="true" className={`inline-block ${popping === reaction.kind ? "animate-reaction-pop" : ""}`}>
              {reaction.emoji}
            </span>
            <span className={done ? "font-medium" : "text-muted-foreground"}>{reaction.label}</span>
            <span className="font-semibold tabular-nums">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
