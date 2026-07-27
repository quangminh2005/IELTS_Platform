"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import {
  LAST_GOOGLE_ACCOUNT_KEY,
  type RememberedGoogleAccount
} from "@/lib/google-account-memory";
import { ChangeRoleLink } from "@/components/auth/change-role-link";
import { GoogleLogo } from "@/components/auth/google-logo";

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "G";
}

export default function StudentLoginPage() {
  const [googleAccount, setGoogleAccount] = useState<RememberedGoogleAccount | null>(null);

  useEffect(() => {
    try {
      const savedAccount = localStorage.getItem(LAST_GOOGLE_ACCOUNT_KEY);

      if (!savedAccount) {
        return;
      }

      const parsedAccount = JSON.parse(savedAccount) as RememberedGoogleAccount;

      if (parsedAccount.email) {
        setGoogleAccount(parsedAccount);
      }
    } catch (_) {
      localStorage.removeItem(LAST_GOOGLE_ACCOUNT_KEY);
    }
  }, []);

  return (
    <div>
      <p className="text-sm font-semibold text-accent">Học viên</p>
      <h2 className="mt-1.5 text-2xl font-bold text-foreground">Chào mừng trở lại</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Đăng nhập bằng đúng email Google mà giáo viên đã thêm vào lớp của bạn.
      </p>

      <button
        className="mt-6 flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3 text-left text-sm font-semibold text-foreground transition hover:border-primary hover:bg-muted"
        type="button"
        onClick={() => signIn("google", { callbackUrl: "/" })}
      >
        <span className="flex min-w-0 items-center gap-3">
          {googleAccount ? (
            googleAccount.image ? (
              <img
                src={googleAccount.image}
                alt=""
                className="h-9 w-9 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {getInitial(googleAccount.name)}
              </span>
            )
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm">
              <GoogleLogo />
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate">
              {googleAccount ? `Tiếp tục với ${googleAccount.name}` : "Tiếp tục với Google"}
            </span>
            {googleAccount ? (
              <span className="mt-0.5 block truncate text-xs font-medium text-muted-foreground">
                {googleAccount.email}
              </span>
            ) : null}
          </span>
        </span>
        <GoogleLogo />
      </button>

      <ChangeRoleLink />
    </div>
  );
}
