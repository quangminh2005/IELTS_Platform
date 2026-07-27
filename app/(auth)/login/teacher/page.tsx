"use client";

import { FormEvent, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  clearRememberedTeacherEmail,
  readRememberedTeacherEmail,
  saveRememberedTeacherEmail
} from "@/lib/auth-preferences";
import { ChangeRoleLink } from "@/components/auth/change-role-link";

export default function TeacherLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const savedEmail = readRememberedTeacherEmail();

    if (savedEmail) {
      setEmail(savedEmail);
      setRemember(true);
    }
  }, []);

  async function handleCredentialsSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl: "/",
      redirect: false
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError("Email hoặc mật khẩu không đúng.");
      return;
    }

    // Chỉ ghi nhớ email; mật khẩu để trình duyệt tự lưu qua form bên dưới.
    if (remember) {
      saveRememberedTeacherEmail(email);
    } else {
      clearRememberedTeacherEmail();
    }

    router.push(result?.url ?? "/");
    router.refresh();
  }

  return (
    <div>
      <p className="text-sm font-semibold text-accent">Giáo viên</p>
      <h2 className="mt-1.5 text-2xl font-bold text-foreground">Chào mừng trở lại</h2>

      {/* method="post" + name trên input là thứ Chrome/Edge dựa vào để hỏi lưu mật khẩu. */}
      <form className="mt-6 space-y-4" method="post" onSubmit={handleCredentialsSignIn}>
        <label className="block">
          <span className="text-sm font-medium text-foreground">Email</span>
          <input
            className="mt-2 w-full rounded-lg border border-border bg-background px-3.5 py-3 text-sm text-foreground outline-none ring-primary/40 transition focus:border-primary focus:ring-2"
            type="email"
            name="email"
            id="teacher-email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            placeholder="ban@example.com"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">Mật khẩu</span>
          <input
            className="mt-2 w-full rounded-lg border border-border bg-background px-3.5 py-3 text-sm text-foreground outline-none ring-primary/40 transition focus:border-primary focus:ring-2"
            type="password"
            name="password"
            id="teacher-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </label>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
          <input
            className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          Ghi nhớ đăng nhập trên máy này
        </label>

        {error ? (
          <p className="rounded-lg border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <button
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>

      <ChangeRoleLink />
    </div>
  );
}
