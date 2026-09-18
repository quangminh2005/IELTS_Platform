import { requireTeacherPage } from "@/lib/teacher-page";
import { prisma } from "@/lib/prisma";
import { ActionForm } from "@/components/action-form";
import {
  createVocabWord,
  hideVocabWord,
  pinVocabWordForTomorrow,
  unpinVocabTomorrow,
  updateVocabWord
} from "@/lib/actions/vocab";
import { dateKeyToUtcDate } from "@/lib/vocab-daily";
import { vietnamDateKey } from "@/lib/vocab-day";
import { shiftDateKey } from "@/lib/vocab-streak";
import { formatVietnamDate } from "@/lib/vocab-words";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

const SOURCE_LABELS: Record<string, string> = {
  listening: "listening",
  reading: "reading",
  manual: "cô thêm"
};

const inputClass =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2";

export default async function TeacherVocabPage({
  searchParams
}: {
  searchParams?: { q?: string; page?: string };
}) {
  await requireTeacherPage();

  const query = searchParams?.q?.trim() ?? "";
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);

  const todayKey = vietnamDateKey(new Date());
  const tomorrowKey = shiftDateKey(todayKey, 1);
  const today = dateKeyToUtcDate(todayKey);
  const tomorrow = dateKeyToUtcDate(tomorrowKey);

  // Tìm cả từ tiếng Anh lẫn nghĩa Việt, không phân biệt hoa thường.
  const where = query
    ? {
        OR: [
          { word: { contains: query.toLowerCase() } },
          { meaningVi: { contains: query, mode: "insensitive" as const } }
        ]
      }
    : {};

  // select tường minh, không dùng include: bảng nguồn có content/transcript rất nặng.
  const [total, words, pinned] = await Promise.all([
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
        // Lần phát gần nhất TÍNH ĐẾN HÔM NAY — dòng ghim cho ngày mai xem riêng.
        dailies: {
          where: { date: { lte: today } },
          select: { date: true },
          take: 1,
          orderBy: { date: "desc" }
        }
      }
    }),
    prisma.vocabDaily.findUnique({
      where: { date: tomorrow },
      select: { wordId: true, word: { select: { display: true } } }
    })
  ]);

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Trang giáo viên</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">Kho từ vựng</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {total} từ. Từ được rút tự động từ đề Listening và Reading — cô ẩn từ rác,
          sửa nghĩa, thêm từ tay hoặc ghim từ cho ngày mai ở đây.
        </p>
      </header>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-card">
        <p>
          <span className="font-semibold">Ngày mai ({formatVietnamDate(tomorrowKey)}):</span>{" "}
          {pinned ? (
            <>
              sẽ phát <span className="font-bold text-primary">{pinned.word.display}</span>
            </>
          ) : (
            <span className="text-muted-foreground">
              chưa ghim — hệ thống tự chọn từ chưa phát.
            </span>
          )}
        </p>
        {pinned ? (
          <ActionForm action={unpinVocabTomorrow}>
            <button
              type="submit"
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition hover:border-destructive hover:text-destructive"
            >
              Bỏ ghim
            </button>
          </ActionForm>
        ) : null}
      </section>

      <details className="rounded-xl border border-border bg-card shadow-card">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
          + Thêm từ tay
        </summary>
        <ActionForm action={createVocabWord} className="grid gap-2 border-t border-border px-4 py-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <input name="display" placeholder="Từ tiếng Anh *" required className={inputClass} aria-label="Từ" />
            <input name="phonetic" placeholder="/phiên âm/" className={inputClass} aria-label="Phiên âm" />
            <input name="partOfSpeech" placeholder="từ loại (noun, verb…)" className={inputClass} aria-label="Từ loại" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="meaningVi" placeholder="Nghĩa tiếng Việt *" required className={inputClass} aria-label="Nghĩa tiếng Việt" />
            <input name="definitionEn" placeholder="Nghĩa tiếng Anh ngắn" className={inputClass} aria-label="Nghĩa tiếng Anh" />
          </div>
          <textarea
            name="exampleEn"
            placeholder="Câu ví dụ tiếng Anh có chứa từ *"
            required
            rows={2}
            className={inputClass}
            aria-label="Câu ví dụ"
          />
          <div>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Thêm vào kho
            </button>
          </div>
        </ActionForm>
      </details>

      <form className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Tìm từ tiếng Anh hoặc nghĩa Việt…"
          className="w-full max-w-sm rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:border-primary hover:text-primary"
        >
          Tìm
        </button>
      </form>

      <div className="space-y-3">
        {words.map((word) => {
          const isPinned = pinned?.wordId === word.id;

          return (
            <article
              key={word.id}
              className={`rounded-xl border p-4 shadow-card ${
                word.hidden
                  ? "border-border bg-muted/50 opacity-70"
                  : isPinned
                    ? "border-primary/60 bg-card"
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
                  {isPinned ? (
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      📌 ngày mai
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {SOURCE_LABELS[word.sourceSkill ?? ""] ?? word.sourceSkill ?? "—"}
                  {word.dailies[0]
                    ? ` · đã phát ${formatVietnamDate(word.dailies[0].date.toISOString().slice(0, 10))}`
                    : " · chưa phát"}
                </p>
              </div>

              <ActionForm action={updateVocabWord} className="mt-3 grid gap-2">
                <input type="hidden" name="wordId" value={word.id} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    name="meaningVi"
                    defaultValue={word.meaningVi}
                    className={inputClass}
                    aria-label="Nghĩa tiếng Việt"
                  />
                  <input
                    name="phonetic"
                    defaultValue={word.phonetic ?? ""}
                    placeholder="/phiên âm/"
                    className={inputClass}
                    aria-label="Phiên âm"
                  />
                </div>
                <textarea
                  name="exampleEn"
                  defaultValue={word.exampleEn}
                  rows={2}
                  className={inputClass}
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

              <div className="mt-2 flex flex-wrap gap-2">
                <ActionForm action={hideVocabWord}>
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
                {!word.hidden && !isPinned ? (
                  <ActionForm action={pinVocabWordForTomorrow}>
                    <input type="hidden" name="wordId" value={word.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-border px-4 py-1.5 text-sm font-semibold transition hover:border-primary hover:text-primary"
                    >
                      Ghim cho ngày mai
                    </button>
                  </ActionForm>
                ) : null}
              </div>
            </article>
          );
        })}
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
