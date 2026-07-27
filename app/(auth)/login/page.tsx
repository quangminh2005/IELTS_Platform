"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LOGIN_PATH_BY_ROLE,
  readPreferredRole,
  savePreferredRole,
  type PreferredRole
} from "@/lib/auth-preferences";

const ROLE_CARDS: Array<{
  role: PreferredRole;
  title: string;
  desc: string;
  icon: JSX.Element;
}> = [
  {
    role: "student",
    title: "Tôi là học viên",
    desc: "Đăng nhập bằng email Google giáo viên đã thêm vào lớp",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <path d="M22 10 12 5 2 10l10 5 10-5Z" />
        <path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5" />
      </svg>
    )
  },
  {
    role: "teacher",
    title: "Tôi là giáo viên",
    desc: "Đăng nhập bằng email và mật khẩu được cấp",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
        <path d="M7 9h6M7 12.5h4" />
      </svg>
    )
  }
];

export default function LoginRolePage() {
  const router = useRouter();
  const [remember, setRemember] = useState(false);
  // Chưa đọc xong localStorage thì hiện khung xám, tránh nháy 2 thẻ rồi mới nhảy trang.
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const savedRole = readPreferredRole();

    if (savedRole) {
      router.replace(LOGIN_PATH_BY_ROLE[savedRole]);
      return;
    }

    setIsChecking(false);
  }, [router]);

  function chooseRole(role: PreferredRole) {
    if (remember) {
      savePreferredRole(role);
    }

    router.push(LOGIN_PATH_BY_ROLE[role]);
  }

  if (isChecking) {
    return (
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-7 w-52 rounded bg-muted" />
        <div className="h-[86px] rounded-xl bg-muted" />
        <div className="h-[86px] rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-semibold text-accent">Đăng nhập an toàn</p>
      <h2 className="mt-1.5 text-2xl font-bold text-foreground">Bạn đăng nhập với vai trò nào?</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Chọn đúng vai trò để tới màn hình đăng nhập phù hợp.
      </p>

      <div className="mt-6 space-y-3">
        {ROLE_CARDS.map((card) => (
          <button
            key={card.role}
            className="flex w-full items-center gap-4 rounded-xl border border-border bg-background px-4 py-4 text-left transition hover:border-primary hover:bg-muted"
            type="button"
            onClick={() => chooseRole(card.role)}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {card.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">{card.title}</span>
              <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                {card.desc}
              </span>
            </span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        ))}
      </div>

      <label className="mt-6 flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
        <input
          className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        />
        Không hỏi lại lần sau trên máy này
      </label>
    </div>
  );
}
