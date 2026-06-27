"use client";

import { FormEvent, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  LAST_GOOGLE_ACCOUNT_KEY,
  type RememberedGoogleAccount
} from "@/lib/google-account-memory";
import { AnimatedThemeToggle } from "@/components/ui/animated-theme-toggle";

function GoogleLogo() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "G";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

    router.push(result?.url ?? "/");
    router.refresh();
  }

  return (
    <main className="relative min-h-screen text-foreground">
      <AnimatedThemeToggle className="fixed right-4 top-4 z-50 shadow-card" />
      <section className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-5 py-12 lg:grid-cols-[1fr_440px] lg:gap-16">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm font-semibold text-primary shadow-card">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
              IE
            </span>
            IELTS Platform
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
            Luyện thi IELTS cùng giáo viên trong một không gian gọn gàng.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
            Giáo viên đăng nhập bằng tài khoản được cấp. Học viên đăng nhập bằng đúng email Google mà
            giáo viên đã thêm vào lớp.
          </p>
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
            {[
              { title: "Giao bài", desc: "Tạo đề từ kho tài liệu" },
              { title: "Làm bài", desc: "Trải nghiệm như thi thật" },
              { title: "Chấm chữa", desc: "Phản hồi chi tiết" }
            ].map((feature) => (
              <div key={feature.title} className="rounded-xl border border-border bg-card p-4 shadow-card">
                <span className="block text-sm font-semibold text-foreground">{feature.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{feature.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-pop sm:p-7">
          <div>
            <p className="text-sm font-semibold text-accent">Đăng nhập an toàn</p>
            <h2 className="mt-1.5 text-2xl font-bold text-foreground">Chào mừng trở lại</h2>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleCredentialsSignIn}>
            <label className="block">
              <span className="text-sm font-medium text-foreground">Email</span>
              <input
                className="mt-2 w-full rounded-lg border border-border bg-background px-3.5 py-3 text-sm text-foreground outline-none ring-primary/40 transition focus:border-primary focus:ring-2"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="ban@example.com"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-foreground">Mật khẩu</span>
              <input
                className="mt-2 w-full rounded-lg border border-border bg-background px-3.5 py-3 text-sm text-foreground outline-none ring-primary/40 transition focus:border-primary focus:ring-2"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
              />
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
              {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập (giáo viên)"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            hoặc
            <span className="h-px flex-1 bg-border" />
          </div>

          <button
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3 text-left text-sm font-semibold text-foreground transition hover:border-primary hover:bg-muted"
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
        </div>
      </section>
    </main>
  );
}
