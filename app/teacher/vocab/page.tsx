import { requireTeacherPage } from "@/lib/teacher-page";
import { prisma } from "@/lib/prisma";
import { ActionForm } from "@/components/action-form";
import { hideVocabWord, updateVocabWord } from "@/lib/actions/vocab";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function TeacherVocabPage({
  searchParams
}: {
  searchParams?: { q?: string; page?: string };
}) {
  await requireTeacherPage();

  const query = searchParams?.q?.trim() ?? "";
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);

  const where = query ? { word: { contains: query.toLowerCase() } } : {};

  // select tường minh, không dùng include: bảng nguồn có content/transcript rất nặng.
  const [total, words] = await Promise.all([
    prisma.vocabWord.count({ where }),
    prisma.vocabWord.findMany({
      where,
      orderBy: { word: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        display: true,
        phonetic: true,
        meaningVi: true,
        exampleEn: true,
        sourceSkill: true,
        hidden: true,
        dailies: { select: { date: true }, take: 1, orderBy: { date: "desc" } }
      }
    })
  ]);

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Trang giáo viên</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">Kho từ vựng</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {total} từ. Từ được rút tự động từ đề Listening và Reading — cô ẩn từ rác
          hoặc sửa nghĩa ở đây.
        </p>
      </header>

      <form className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Tìm từ…"
          className="w-full max-w-xs rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:border-primary hover:text-primary"
        >
          Tìm
        </button>
      </form>

      <div className="space-y-3">
        {words.map((word) => (
          <article
            key={word.id}
            className={`rounded-xl border p-4 shadow-card ${
              word.hidden
                ? "border-border bg-muted/50 opacity-70"
                : "border-border bg-card"
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">
                {word.display}
                {word.hidden ? (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    (đang ẩn)
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {word.sourceSkill ?? "—"}
                {word.dailies[0]
                  ? ` · đã phát ${word.dailies[0].date.toISOString().slice(0, 10)}`
                  : " · chưa phát"}
              </p>
            </div>

            <ActionForm action={updateVocabWord} className="mt-3 grid gap-2">
              <input type="hidden" name="wordId" value={word.id} />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  name="meaningVi"
                  defaultValue={word.meaningVi}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  aria-label="Nghĩa tiếng Việt"
                />
                <input
                  name="phonetic"
                  defaultValue={word.phonetic ?? ""}
                  placeholder="/phiên âm/"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  aria-label="Phiên âm"
                />
              </div>
              <textarea
                name="exampleEn"
                defaultValue={word.exampleEn}
                rows={2}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                aria-label="Câu ví dụ"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  Lưu
                </button>
              </div>
            </ActionForm>

            <ActionForm action={hideVocabWord} className="mt-2">
              <input type="hidden" name="wordId" value={word.id} />
              <input
                type="hidden"
                name="hidden"
                value={word.hidden ? "false" : "true"}
              />
              <button
                type="submit"
                className="rounded-lg border border-border px-4 py-1.5 text-sm font-semibold transition hover:border-destructive hover:text-destructive"
              >
                {word.hidden ? "Bỏ ẩn" : "Ẩn từ này"}
              </button>
            </ActionForm>
          </article>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm">
        <a
          href={`/teacher/vocab?q=${encodeURIComponent(query)}&page=${Math.max(1, page - 1)}`}
          className={page <= 1 ? "pointer-events-none opacity-40" : "hover:text-primary"}
        >
          ← Trang trước
        </a>
        <span className="text-muted-foreground">
          Trang {page}/{lastPage}
        </span>
        <a
          href={`/teacher/vocab?q=${encodeURIComponent(query)}&page=${Math.min(lastPage, page + 1)}`}
          className={
            page >= lastPage ? "pointer-events-none opacity-40" : "hover:text-primary"
          }
        >
          Trang sau →
        </a>
      </div>
    </div>
  );
}
