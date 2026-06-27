"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5 text-left text-sm font-semibold text-foreground transition hover:border-red-400/60 hover:bg-red-500/5 hover:text-red-600"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5 shrink-0"
        aria-hidden="true"
      >
        <path d="M15 17v1.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 18.5v-13A1.5 1.5 0 0 1 6.5 4h7A1.5 1.5 0 0 1 15 5.5V7" />
        <path d="M10 12h10M17 9l3 3-3 3" />
      </svg>
      <span className="leading-tight">
        <span className="block">Đăng xuất</span>
        <span className="block text-xs font-normal text-muted-foreground">Về trang đăng nhập</span>
      </span>
    </button>
  );
}
