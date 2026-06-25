"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("teacher@example.com");
  const [password, setPassword] = useState("teacher123");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setError("Email or password is incorrect.");
      return;
    }

    router.push(result?.url ?? "/");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-[1fr_420px]">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">IELTS Platform</p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight text-white sm:text-5xl">
            Run teacher-led IELTS practice from one focused workspace.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
            Sign in as a teacher with demo credentials, or join as a student with the Google email your teacher added.
          </p>
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
            {["Assign", "Practice", "Review"].map((label) => (
              <div key={label} className="border border-border bg-muted/45 px-4 py-3">
                <span className="text-sm font-medium text-white">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-border bg-muted/70 p-6 shadow-2xl shadow-black/30 backdrop-blur">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-accent">Secure access</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Welcome back</h2>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleCredentialsSignIn}>
            <label className="block">
              <span className="text-sm font-medium text-muted-foreground">Email</span>
              <input
                className="mt-2 w-full border border-border bg-background px-3 py-3 text-sm text-white outline-none transition focus:border-primary"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-muted-foreground">Password</span>
              <input
                className="mt-2 w-full border border-border bg-background px-3 py-3 text-sm text-white outline-none transition focus:border-primary"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>

            {error ? <p className="text-sm text-red-300">{error}</p> : null}

            <button
              className="w-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in..." : "Sign in as teacher"}
            </button>
          </form>

          <div className="my-6 h-px bg-border" />

          <button
            className="flex w-full items-center justify-center gap-3 border border-border bg-background px-4 py-3 text-sm font-semibold text-white transition hover:border-primary"
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/" })}
          >
            <span className="flex h-5 w-5 items-center justify-center bg-white text-xs font-bold text-background">G</span>
            Continue as Google student
          </button>
        </div>
      </section>
    </main>
  );
}
