"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="mt-4 w-full rounded-md border border-border bg-background/60 px-4 py-3 text-left text-sm font-semibold text-foreground transition hover:border-primary/60 hover:bg-primary/10"
    >
      Log out
      <span className="mt-1 block text-xs font-normal text-muted-foreground">
        Return to login
      </span>
    </button>
  );
}
