export default function WaitingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">Access pending</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight text-foreground">
          Your Google email has not been added yet.
        </h1>
        <p className="mt-5 text-base leading-7 text-muted-foreground">
          Ask your teacher to add the exact Google email you used to the student list, then sign in again.
        </p>
      </section>
    </main>
  );
}
