"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { startPractice } from "@/lib/actions/practice";
import { XP_HIDDEN_AUDIO_FACTOR } from "@/lib/monthly-xp";
import {
  BookOpenIcon,
  CheckIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  HeadphonesIcon,
  LayersIcon,
  MicIcon,
  NotebookIcon,
  PenToolIcon,
  SearchIcon
} from "@/components/icons";
import { formatBand } from "@/lib/band-score";
import {
  compareTitles,
  countByQuestionGroup,
  materialCoverText,
  partLabelOf,
  shortMaterialTitle,
  sortBooks,
  unitCardText,
  type PracticeMaterialItem,
  type PracticeResumeState,
  type PracticeUnitItem
} from "@/lib/practice-library";
import { QUESTION_GROUPS, type QuestionGroupKey } from "@/lib/question-stats";
import { distinctSkills, SKILL_LABELS } from "@/lib/skills";

// "+50%" — đọc thẳng hệ số trong lib/monthly-xp.ts để nhãn không lệch cách cộng thật.
const HIDDEN_AUDIO_BONUS = `+${Math.round((XP_HIDDEN_AUDIO_FACTOR - 1) * 100)}%`;
// Nhớ lựa chọn "ẩn thanh audio" lần trước của học viên (tiện, không bắt buộc).
const HIDE_AUDIO_STORAGE_KEY = "practiceHideAudio";

// Hỏi "ẩn thanh audio" hay không: "none" = phạm vi không có audio Nghe; "forced" =
// thầy đã bật ẩn cho đề (học viên không gỡ được).
type AudioChoice = "none" | "choice" | "forced";

function audioChoiceOf(hasAudio: boolean, forced: boolean): AudioChoice {
  if (!hasAudio) return "none";
  return forced ? "forced" : "choice";
}

const GROUP_LABELS = Object.fromEntries(
  QUESTION_GROUPS.map((group) => [group.key, group.label])
) as Record<QuestionGroupKey, string>;

type PracticeTarget = {
  materialId: string;
  unitId: string | null;
  label: string;
  // Lượt đang làm dở của đúng phạm vi này (null = mở lượt mới).
  resume: PracticeResumeState | null;
  // Học viên bấm "Làm lại": bỏ lượt dở, làm lại từ đầu với lựa chọn giờ mới.
  restart: boolean;
  audio: AudioChoice;
};

const PAGE_SIZE = 24;

// Màu bìa thẻ: mỗi kỹ năng một dải màu (cùng tông SKILL_PILL_CLASSES), mỗi đề lấy
// một biến thể theo id để lưới thẻ không đơn điệu một màu như nhau (chin dùng ảnh
// minh hoạ riêng từng bài; mình chưa có ảnh nên đổi màu). Viết đủ tên class để
// Tailwind quét được.
const COVER_CLASSES: Record<string, string[]> = {
  listening: [
    "from-emerald-400 via-emerald-600 to-teal-800",
    "from-teal-400 via-teal-600 to-cyan-800",
    "from-lime-400 via-green-600 to-emerald-800",
    "from-green-400 via-emerald-700 to-slate-800"
  ],
  reading: [
    "from-sky-400 via-sky-600 to-indigo-800",
    "from-cyan-400 via-blue-600 to-indigo-800",
    "from-blue-400 via-indigo-600 to-violet-800",
    "from-indigo-400 via-blue-700 to-slate-800"
  ],
  writing: [
    "from-amber-400 via-orange-500 to-rose-700",
    "from-yellow-400 via-amber-600 to-orange-800",
    "from-orange-400 via-red-500 to-rose-800",
    "from-rose-400 via-pink-600 to-red-800"
  ],
  speaking: [
    "from-violet-400 via-violet-600 to-fuchsia-800",
    "from-fuchsia-400 via-purple-600 to-indigo-800",
    "from-purple-400 via-fuchsia-600 to-pink-800",
    "from-pink-400 via-purple-600 to-violet-800"
  ]
};

function coverClass(skill: string, seed: string): string {
  const palette = COVER_CLASSES[skill] ?? COVER_CLASSES.listening;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return palette[hash % palette.length];
}

const SKILL_ICONS: Record<string, (props: { className?: string }) => JSX.Element> = {
  listening: HeadphonesIcon,
  reading: BookOpenIcon,
  writing: PenToolIcon,
  speaking: MicIcon
};

// "Part" của bộ lọc: "all" = mọi phần, số = đúng Part/Passage/Task đó, "full" =
// xem theo cả đề (thẻ full test) — giống hàng chip "Tất cả part / Part 1… / Tất cả
// full test" của chin.
type PartFilter = "all" | number | "full";
type StatusFilter = "todo" | "done" | null;

type UnitCard = {
  material: PracticeMaterialItem;
  unit: PracticeUnitItem;
};

const topChip =
  "shrink-0 whitespace-nowrap rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-foreground";
const topChipActive =
  "shrink-0 whitespace-nowrap rounded-full border border-primary bg-primary/15 px-3 py-1 text-xs font-semibold text-primary";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh"
  });
}

function matchesQuery(text: string, query: string): boolean {
  return !query || text.toLowerCase().includes(query);
}

export function PracticeLibrary({
  items,
  initialGroup = null,
  initialSkill,
  noticeMessage,
  noticeNonce
}: {
  items: PracticeMaterialItem[];
  // Lọc sẵn theo dạng câu khi mở từ link "Luyện dạng này" (?type=).
  initialGroup?: QuestionGroupKey | null;
  // Mở sẵn tab kỹ năng (?skill=listening), kiểu ?module= của chin.
  initialSkill?: string;
  noticeMessage?: string;
  noticeNonce?: string;
}) {
  // Các kỹ năng có đề, theo thứ tự chuẩn Nghe→Đọc→Viết→Nói.
  const skills = useMemo(() => distinctSkills(items.map((item) => item.skill)), [items]);

  const [skill, setSkill] = useState<string>(() => {
    if (initialSkill && skills.includes(initialSkill)) return initialSkill;
    // Lọc dạng câu từ trang Tiến bộ: mở tab kỹ năng đầu tiên có dạng đó.
    if (initialGroup) {
      const withGroup = items.find((item) => item.questionGroups.includes(initialGroup));
      if (withGroup) return withGroup.skill;
    }
    return skills[0] ?? "listening";
  });
  const [book, setBook] = useState<string | null>(null);
  const [part, setPart] = useState<PartFilter>("all");
  const [status, setStatus] = useState<StatusFilter>(null);
  const [group, setGroup] = useState<QuestionGroupKey | null>(initialGroup);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [typesOpen, setTypesOpen] = useState(true);
  const [booksOpen, setBooksOpen] = useState(false);
  const [target, setTarget] = useState<PracticeTarget | null>(null);

  // startPractice gặp lỗi (đề vừa bị gỡ khỏi thư viện, đề chưa có phần nào...)
  // thì redirect MỀM về chính trang này kèm practiceMessage — cây component
  // không unmount nên state `target` (hộp thoại đang mở) còn nguyên, khiến hộp
  // thoại cũ đứng im dưới toast lỗi và học viên bấm lại đúng nút vừa lỗi. Đóng
  // hộp thoại mỗi khi nhận được thông báo mới từ server. Phụ thuộc thêm
  // `noticeNonce` (giá trị luôn MỚI mỗi lần redirect, xem lib/practice-notices.ts)
  // chứ không chỉ mình `noticeMessage`: hai lần lỗi liên tiếp trùng y nội dung
  // (bấm trúng đúng nút vừa lỗi) sẽ cho `noticeMessage` giống hệt lần trước, effect
  // sẽ không chạy lại nếu chỉ so theo message — nonce đảm bảo luôn nhận ra "đây là
  // lần mới".
  useEffect(() => {
    if (noticeMessage) {
      setTarget(null);
    }
  }, [noticeMessage, noticeNonce]);

  // Đổi bất kỳ bộ lọc nào thì quay về trang 1.
  useEffect(() => {
    setPage(1);
  }, [skill, book, part, status, group, search]);

  const query = search.trim().toLowerCase();

  // Toàn bộ tính toán lọc/đếm gói trong một useMemo — mỗi tầng lọc nhận kết quả
  // tầng trước, số trên chip luôn khớp số thẻ hiện ra khi bấm chip đó.
  const view = useMemo(() => {
    // Tầng 1: kỹ năng -> danh sách bộ sách.
    const skillItems = items.filter((item) => item.skill === skill);
    const ieltsByBook = new Map<string, boolean>();
    for (const item of skillItems) {
      const ielts = item.units.some((unit) => unit.partNumber !== null);
      ieltsByBook.set(item.book, (ieltsByBook.get(item.book) ?? false) || ielts);
    }
    const books = sortBooks(
      [...ieltsByBook].map(([name, ieltsFormat]) => ({ name, ieltsFormat }))
    );
    const bookOrder = new Map(books.map((name, index) => [name, index]));

    // Tầng 2: bộ sách + ô tìm.
    const inBook = skillItems
      .filter((item) => book === null || item.book === book)
      .sort(
        (a, b) =>
          (bookOrder.get(a.book) ?? 0) - (bookOrder.get(b.book) ?? 0) ||
          compareTitles(a.title, b.title)
      );
    const unitsSearched: UnitCard[] = inBook.flatMap((material) =>
      material.units
        .filter((unit) => unit.questionCount > 0)
        .filter((unit) =>
          matchesQuery(`${unit.title} ${material.title} ${material.book}`, query)
        )
        .map((unit) => ({ material, unit }))
    );
    const materialsSearched = inBook.filter((item) =>
      matchesQuery(
        `${item.title} ${item.book} ${item.sourceLabel ?? ""} ${item.units
          .map((unit) => unit.title)
          .join(" ")}`,
        query
      )
    );

    // Số trên chip Part: sau bộ sách + ô tìm, trước trạng thái/dạng — như chin.
    const partTally = new Map<number, number>();
    for (const card of unitsSearched) {
      if (card.unit.partNumber === null) continue;
      partTally.set(card.unit.partNumber, (partTally.get(card.unit.partNumber) ?? 0) + 1);
    }
    const partCounts = [...partTally].sort((a, b) => a[0] - b[0]);

    // Tầng 3: Part + trạng thái -> đếm dạng câu -> lọc dạng câu.
    const isFull = part === "full";
    const unitsBeforeGroup = unitsSearched.filter((card) => {
      if (typeof part === "number" && card.unit.partNumber !== part) return false;
      if (status === "done" && card.unit.rounds === 0) return false;
      if (status === "todo" && card.unit.rounds > 0) return false;
      return true;
    });
    const materialsBeforeGroup = materialsSearched.filter((item) => {
      if (status === "done" && item.rounds === 0) return false;
      if (status === "todo" && item.rounds > 0) return false;
      return true;
    });

    const groupChips = countByQuestionGroup(
      isFull ? materialsBeforeGroup : unitsBeforeGroup.map((card) => card.unit)
    );
    // Dạng đang chọn mà hết bài (vừa đổi bộ lọc khác) vẫn giữ chip để còn chỗ bỏ chọn.
    if (group && !groupChips.some((chip) => chip.key === group)) {
      groupChips.push({ key: group, label: GROUP_LABELS[group], count: 0 });
    }

    const unitResults = group
      ? unitsBeforeGroup.filter((card) => card.unit.questionGroups.includes(group))
      : unitsBeforeGroup;
    const materialResults = group
      ? materialsBeforeGroup.filter((item) => item.questionGroups.includes(group))
      : materialsBeforeGroup;

    return {
      skillItems,
      books,
      unitsSearched,
      materialsSearched,
      partCounts,
      isFull,
      groupChips,
      unitResults,
      materialResults
    };
  }, [items, skill, book, part, status, group, query]);

  const { isFull, books, partCounts, groupChips } = view;
  const total = isFull ? view.materialResults.length : view.unitResults.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;

  const partWord = partLabelOf(skill, 0).replace(/\s*0$/, "");
  const SkillIcon = SKILL_ICONS[skill] ?? NotebookIcon;

  function goToPage(number: number) {
    setPage(number);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Chưa có đề nào trong thư viện tự luyện. Hãy nhắc giáo viên mở thêm đề nhé.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* Tab kỹ năng — như thanh Nghe/Đọc/Viết/Nói của chin */}
      <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
        {skills.map((key) => {
          const Icon = SKILL_ICONS[key] ?? NotebookIcon;
          const active = key === skill;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setSkill(key);
                setBook(null);
                setPart("all");
                setGroup(null);
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-sm font-semibold transition sm:gap-2 sm:px-4 ${
                active
                  ? "border-primary bg-primary text-primary-foreground shadow"
                  : "border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {SKILL_LABELS[key] ?? key}
            </button>
          );
        })}
      </div>

      {/* Khối bộ lọc trên cùng */}
      <section className="space-y-3 rounded-2xl border border-border bg-card/80 p-3 sm:p-4">
        {/* Hàng 1: bộ sách */}
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {[null, ...books].map((name) => (
            <button
              key={name ?? "__all"}
              type="button"
              aria-pressed={book === name}
              onClick={() => setBook(name)}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                book === name
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <LayersIcon className="h-3.5 w-3.5 opacity-70" />
              {name ?? "Tất cả bộ"}
            </button>
          ))}
        </div>

        {/* Hàng 2: Part + full test | trạng thái */}
        {/* Điện thoại: mỗi hàng chip cuộn ngang thay vì xuống 3–4 dòng (đỡ phải cuộn
            trang mới thấy thẻ bài). */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <button
              type="button"
              onClick={() => setPart("all")}
              className={part === "all" ? topChipActive : topChip}
            >
              Tất cả {partWord.toLowerCase()} ({view.unitsSearched.length})
            </button>
            {partCounts.map(([number, count]) => (
              <button
                key={number}
                type="button"
                onClick={() => setPart(part === number ? "all" : number)}
                className={part === number ? topChipActive : topChip}
              >
                {partLabelOf(skill, number)} ({count})
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPart(isFull ? "all" : "full")}
              className={`inline-flex items-center gap-1 ${isFull ? topChipActive : topChip}`}
            >
              <ClipboardCheckIcon className="h-3.5 w-3.5" />
              Tất cả full test ({view.materialsSearched.length})
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            {(
              [
                ["todo", "Chưa làm"],
                ["done", "Đã làm"]
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={status === key}
                onClick={() => setStatus(status === key ? null : key)}
                className={`inline-flex items-center gap-1 ${status === key ? topChipActive : topChip}`}
              >
                {key === "done" ? (
                  <CheckIcon className="h-3.5 w-3.5" />
                ) : (
                  <span className="inline-block h-3 w-3 rounded-full border-2 border-current" />
                )}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Hàng 3: dạng câu hỏi */}
        {groupChips.length > 0 ? (
          <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto border-t border-border px-1 pt-3 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <span className="mr-1 shrink-0 text-xs font-medium text-muted-foreground">
              Dạng câu hỏi
            </span>
            <button
              type="button"
              onClick={() => setGroup(null)}
              className={group === null ? topChipActive : topChip}
            >
              Tất cả dạng
            </button>
            {groupChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                aria-pressed={group === chip.key}
                onClick={() => setGroup(group === chip.key ? null : chip.key)}
                className={group === chip.key ? topChipActive : topChip}
              >
                {chip.label} ({chip.count})
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Thanh bên "Part & Bộ lọc" (chỉ máy tính — điện thoại đã có khối trên) */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-3 rounded-2xl border border-border bg-card/80 p-3">
            <p className="flex items-center gap-2 px-1 text-sm font-semibold">
              <SkillIcon className="h-4 w-4 text-primary" />
              {partWord} & Bộ lọc
            </p>

            <div className="overflow-hidden rounded-xl border border-border">
              <p className="bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                {SKILL_LABELS[skill] ?? skill} · {partWord}
              </p>
              <div className="space-y-0.5 p-1.5">
                <SideRow
                  active={part === "all"}
                  onClick={() => setPart("all")}
                  count={view.unitsSearched.length}
                >
                  Tất cả {partWord.toLowerCase()}
                </SideRow>
                {partCounts.map(([number, count]) => (
                  <SideRow
                    key={number}
                    active={part === number}
                    onClick={() => setPart(number)}
                    count={count}
                    icon={<SkillIcon className="h-3.5 w-3.5" />}
                  >
                    {partLabelOf(skill, number)}
                  </SideRow>
                ))}
              </div>
            </div>

            {groupChips.length > 0 ? (
              <SideSection
                title="Dạng câu hỏi"
                open={typesOpen}
                onToggle={() => setTypesOpen((open) => !open)}
              >
                <SideRow active={group === null} onClick={() => setGroup(null)}>
                  Tất cả dạng
                </SideRow>
                {groupChips.map((chip) => (
                  <SideRow
                    key={chip.key}
                    active={group === chip.key}
                    onClick={() => setGroup(group === chip.key ? null : chip.key)}
                    count={chip.count}
                  >
                    {chip.label}
                  </SideRow>
                ))}
              </SideSection>
            ) : null}

            <SideSection
              title="Tất cả full test"
              open={booksOpen}
              onToggle={() => setBooksOpen((open) => !open)}
            >
              <SideRow
                active={isFull && book === null}
                onClick={() => {
                  setPart("full");
                  setBook(null);
                }}
                count={view.skillItems.length}
              >
                Mọi bộ đề
              </SideRow>
              {books.map((name) => (
                <SideRow
                  key={name}
                  active={isFull && book === name}
                  onClick={() => {
                    setPart("full");
                    setBook(name);
                  }}
                  count={view.skillItems.filter((item) => item.book === name).length}
                >
                  {name}
                </SideRow>
              ))}
            </SideSection>
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <label className="flex items-center gap-2 rounded-xl border border-border bg-card/80 px-3 py-2.5 focus-within:border-primary">
            <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                isFull
                  ? "Tìm theo tên full test ở mọi bộ đề (VD: Cambridge IELTS 10)"
                  : "Tìm theo tên bài ở mọi bộ đề"
              }
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>

          {total === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Không có bài nào khớp bộ lọc. Thử bỏ bớt điều kiện lọc nhé.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-5 min-[1800px]:grid-cols-6">
              {isFull
                ? view.materialResults
                    .slice(start, start + PAGE_SIZE)
                    .map((item) => (
                      <FullTestCard key={item.id} item={item} onOpenDialog={setTarget} />
                    ))
                : view.unitResults
                    .slice(start, start + PAGE_SIZE)
                    .map((card) => (
                      <PartCard
                        key={card.unit.id}
                        card={card}
                        highlightGroup={group}
                        onOpenDialog={setTarget}
                      />
                    ))}
            </ul>
          )}

          {pageCount > 1 ? (
            <nav className="flex flex-col items-center gap-2 pt-2" aria-label="Phân trang">
              <div className="flex flex-wrap items-center justify-center gap-1">
                <PageButton disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}>
                  Trước
                </PageButton>
                {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
                  <PageButton
                    key={number}
                    active={number === currentPage}
                    onClick={() => goToPage(number)}
                  >
                    {number}
                  </PageButton>
                ))}
                <PageButton
                  disabled={currentPage === pageCount}
                  onClick={() => goToPage(currentPage + 1)}
                >
                  Sau
                </PageButton>
              </div>
              <p className="text-xs text-muted-foreground">
                Trang {currentPage} / {pageCount} ({total} {isFull ? "đề" : "bài tập"})
              </p>
            </nav>
          ) : null}
        </div>
      </div>

      {target ? <TimeChoiceDialog target={target} onClose={() => setTarget(null)} /> : null}
    </div>
  );
}

function SideRow({
  active,
  onClick,
  count,
  icon,
  children
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
        active
          ? "bg-primary/15 font-semibold text-primary"
          : "text-foreground/80 hover:bg-muted hover:text-foreground"
      }`}
    >
      {icon ? <span className="shrink-0 text-primary/80">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {count !== undefined ? (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{count}</span>
      ) : null}
    </button>
  );
}

function SideSection({
  title,
  open,
  onToggle,
  children
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-semibold hover:bg-muted"
      >
        {title}
        <ChevronRightIcon className={`h-4 w-4 transition ${open ? "rotate-90" : ""}`} />
      </button>
      {open ? <div className="space-y-0.5 border-t border-border p-1.5">{children}</div> : null}
    </div>
  );
}

function PageButton({
  active = false,
  disabled = false,
  onClick,
  children
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-w-9 rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:border-primary"
      }`}
    >
      {children}
    </button>
  );
}

// Huy hiệu góc trên của thẻ: "✓ Đã làm" bên trái, điểm/Band bên phải.
function DoneBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-bold text-white shadow">
      <CheckIcon className="h-3 w-3" />
      Đã làm
    </span>
  );
}

function ResumeBadge({ children = "Đang làm dở" }: { children?: ReactNode }) {
  return (
    <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-amber-950 shadow">
      {children}
    </span>
  );
}

function scoreBadgeClass(ratio: number): string {
  if (ratio >= 0.8) return "bg-emerald-500 text-white";
  if (ratio >= 0.5) return "bg-amber-500 text-white";
  return "bg-rose-500 text-white";
}

const cardButtonClass =
  "group relative flex aspect-[3/4] w-full flex-col overflow-hidden rounded-2xl bg-gradient-to-br text-left text-white shadow-md ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl";

function RestartLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
    >
      Làm lại từ đầu
    </button>
  );
}

// Thẻ một Part (kiểu chin): bìa màu theo kỹ năng, chủ đề + "Part 1" + tên đề ở
// đáy; góc trên "Đã làm" + số câu đúng cao nhất. Bấm cả thẻ để luyện phần đó.
function PartCard({
  card,
  highlightGroup,
  onOpenDialog
}: {
  card: UnitCard;
  highlightGroup: QuestionGroupKey | null;
  onOpenDialog: (target: PracticeTarget) => void;
}) {
  const { material, unit } = card;
  const { badge, topic } = unitCardText(material.skill, unit.title);
  const Icon = SKILL_ICONS[material.skill] ?? NotebookIcon;
  const testTitle = shortMaterialTitle(material.title);
  const target: PracticeTarget = {
    materialId: material.id,
    unitId: unit.id,
    label: `${testTitle} — ${unit.title}`,
    resume: unit.resume,
    restart: false,
    audio: audioChoiceOf(unit.hasAudio, material.lockAudioForced)
  };

  return (
    <li className="flex flex-col gap-1.5">
      <PracticeStartButton
        target={target}
        onOpenDialog={onOpenDialog}
        className={`${cardButtonClass} ${coverClass(material.skill, material.id)}`}
      >
        <span className="pointer-events-none absolute -right-6 top-8 opacity-20 transition group-hover:scale-110">
          <Icon className="h-32 w-32" />
        </span>
        <span className="relative flex items-start justify-between gap-1 p-2">
          {unit.resume ? <ResumeBadge /> : unit.rounds > 0 ? <DoneBadge /> : <span />}
          {unit.rounds > 0 && unit.bestCorrect !== null && unit.questionCount > 0 ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums shadow ${scoreBadgeClass(
                unit.bestCorrect / unit.questionCount
              )}`}
            >
              {unit.bestCorrect}/{unit.questionCount}
            </span>
          ) : null}
        </span>
        <span className="relative mt-auto block bg-gradient-to-t from-black/75 via-black/45 to-transparent p-2.5 pt-10">
          <span className="line-clamp-3 block text-sm font-bold leading-snug drop-shadow sm:text-[15px]">
            {/* Unit chỉ tên "Part 1" thì nhãn đã nói rồi — in tên đề làm chủ đề. */}
            {topic === badge ? testTitle : topic}
          </span>
          <span className="mt-1.5 flex flex-wrap gap-1">
            {badge ? (
              <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[11px] font-semibold backdrop-blur">
                {badge}
              </span>
            ) : null}
            <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[11px] font-semibold backdrop-blur">
              {unit.questionCount} câu
            </span>
            {highlightGroup && unit.questionGroups.includes(highlightGroup) ? (
              <span className="rounded-md bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-900">
                {GROUP_LABELS[highlightGroup]}
              </span>
            ) : null}
          </span>
          <span className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-white/85">
            <LayersIcon className="h-3 w-3 shrink-0" />
            <span className="truncate">{testTitle}</span>
          </span>
        </span>
      </PracticeStartButton>
      {unit.resume ? (
        <RestartLink onClick={() => onOpenDialog({ ...target, restart: true })} />
      ) : null}
    </li>
  );
}

// Thẻ full test (kiểu chin): bìa in "CAMBRIDGE IELTS / 10 / TEST 1", góc trên "Đã
// làm" + Band (đề đủ 40 câu) hoặc "1/4 phần đã làm"; đáy "Lần gần nhất · N lần".
function FullTestCard({
  item,
  onOpenDialog
}: {
  item: PracticeMaterialItem;
  onOpenDialog: (target: PracticeTarget) => void;
}) {
  const cover = materialCoverText(item.title);
  const Icon = SKILL_ICONS[item.skill] ?? NotebookIcon;
  const title = shortMaterialTitle(item.title);
  const doneUnits = item.units.filter((unit) => unit.rounds > 0).length;
  // "Đã làm" khi đã nộp một lượt cả đề, hoặc đã luyện lẻ đủ mọi phần.
  const fullyDone =
    item.bestCorrect !== null || (doneUnits > 0 && doneUnits === item.units.length);
  const target: PracticeTarget = {
    materialId: item.id,
    unitId: null,
    label: title,
    resume: item.resume,
    restart: false,
    audio: audioChoiceOf(item.hasAudio, item.lockAudioForced)
  };

  return (
    <li className="flex flex-col gap-1.5">
      <PracticeStartButton
        target={target}
        onOpenDialog={onOpenDialog}
        className={`${cardButtonClass} ${coverClass(item.skill, item.id)}`}
      >
        <span className="relative flex items-start justify-between gap-1 p-2">
          {item.resume ? (
            <ResumeBadge />
          ) : fullyDone ? (
            <DoneBadge />
          ) : doneUnits > 0 ? (
            <ResumeBadge>
              {doneUnits}/{item.units.length} phần đã làm
            </ResumeBadge>
          ) : (
            <span />
          )}
          {item.band !== null ? (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white shadow">
              Band {formatBand(item.band)}
            </span>
          ) : item.bestCorrect !== null && item.questionCount > 0 ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums shadow ${scoreBadgeClass(
                item.bestCorrect / item.questionCount
              )}`}
            >
              {item.bestCorrect}/{item.questionCount}
            </span>
          ) : null}
        </span>
        <span className="flex flex-1 flex-col items-center justify-center px-2 text-center">
          <span className="line-clamp-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white/90 sm:text-xs">
            {cover.kicker}
          </span>
          {cover.big ? (
            <span className="my-1 text-5xl font-black leading-none drop-shadow sm:text-6xl">
              {cover.big}
            </span>
          ) : null}
          {cover.sub ? (
            <span className="line-clamp-2 text-sm font-bold uppercase tracking-[0.15em]">
              {cover.sub}
            </span>
          ) : null}
          <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur">
            <Icon className="h-3 w-3" />
            {SKILL_LABELS[item.skill] ?? item.skill}
          </span>
        </span>
        {item.lastPracticedAt ? (
          <span className="m-2 flex items-center justify-between gap-1 rounded-lg bg-black/30 px-2 py-1 text-[10px] font-semibold backdrop-blur sm:text-[11px]">
            <span className="truncate">Lần gần nhất: {formatDate(item.lastPracticedAt)}</span>
            <span className="shrink-0">{item.rounds} lần</span>
          </span>
        ) : null}
      </PracticeStartButton>
      <p className="line-clamp-1 text-sm font-semibold" title={item.title}>
        {title}
      </p>
      <div className="flex flex-wrap gap-1">
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {item.unitCount} phần
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {item.questionCount} câu hỏi
        </span>
      </div>
      {item.resume ? (
        <RestartLink onClick={() => onOpenDialog({ ...target, restart: true })} />
      ) : null}
    </li>
  );
}

// Nút mở một phạm vi luyện. Chỉ hỏi khi câu hỏi còn nghĩa:
//   - chưa có lượt dở → hỏi "tính giờ hay không" (lượt mới, chọn sao được vậy);
//   - lượt dở CÒN đồng hồ → hỏi "giữ hay bỏ đồng hồ" (bỏ thì được, xem
//     shouldClearTimeLimitsOnResume);
//   - lượt dở KHÔNG có đồng hồ → không còn gì để hỏi (startPractice cố tình không
//     siết giờ giữa chừng), vào thẳng phòng làm bài.
function PracticeStartButton({
  target,
  onOpenDialog,
  className,
  children
}: {
  target: PracticeTarget;
  onOpenDialog: (target: PracticeTarget) => void;
  className: string;
  children: ReactNode;
}) {
  if (target.resume && !target.resume.timed) {
    return (
      <form action={startPractice}>
        <input type="hidden" name="materialId" value={target.materialId} />
        <input type="hidden" name="unitId" value={target.unitId ?? ""} />
        <input type="hidden" name="timed" value="0" />
        <PracticeSubmitButton className={className} pendingLabel="Đang mở bài…">
          {children}
        </PracticeSubmitButton>
      </form>
    );
  }

  return (
    <button type="button" onClick={() => onOpenDialog(target)} className={className}>
      {children}
    </button>
  );
}

function TimeChoiceDialog({
  target,
  onClose
}: {
  target: PracticeTarget;
  onClose: () => void;
}) {
  // Chỉ dựng portal sau khi mount ở client (document.body đã sẵn sàng).
  const [mounted, setMounted] = useState(false);
  const [hideAudio, setHideAudio] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setHideAudio(window.localStorage.getItem(HIDE_AUDIO_STORAGE_KEY) === "1");
    } catch {
      // localStorage bị chặn (riêng tư/iOS) -> mặc định không ẩn.
    }
  }, []);

  // Chỉ hỏi khi mở lượt MỚI (luyện lần đầu hoặc "Làm lại"): lượt đang dở giữ nguyên
  // chế độ audio — đổi giữa chừng thì nghe xong mới bật ẩn để ăn thưởng.
  const asksAudio = target.audio !== "none" && (!target.resume || target.restart);
  const audioHidden = target.audio === "forced" || hideAudio;

  function toggleHideAudio(next: boolean) {
    setHideAudio(next);
    try {
      window.localStorage.setItem(HIDE_AUDIO_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Không lưu được thì thôi, lựa chọn vẫn có tác dụng cho lần bấm này.
    }
  }

  if (!mounted) {
    return null;
  }

  // Portal ra <body>: layout (AppShell) bọc nội dung trang trong div có
  // `animate-fade-in` (transform), biến div đó thành containing block cho
  // `position: fixed` — hộp thoại sẽ bị canh giữa theo TRANG thay vì màn hình
  // nếu render tại chỗ. Xem components/notice-toast.tsx, submit-celebration.tsx.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg">
        <p className="text-sm font-semibold">{target.label}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {/* Ba tình huống, ba câu hỏi khác nhau — hộp thoại không bao giờ được hỏi
              một câu mà server không thực hiện được (xem PracticeStartButton). */}
          {target.restart
            ? "Làm lại từ đầu sẽ XOÁ bài em đang làm dở. Em muốn làm lại thế nào?"
            : target.resume
              ? "Em đang làm dở bài này và đồng hồ vẫn đang đếm ngược."
              : "Em muốn làm bài này thế nào?"}
        </p>

        {asksAudio ? (
          <label
            className={`mt-4 flex items-start gap-3 rounded-lg border p-3 transition ${
              audioHidden ? "border-primary bg-primary/10" : "border-border hover:border-primary"
            } ${target.audio === "forced" ? "cursor-default" : "cursor-pointer"}`}
          >
            <input
              type="checkbox"
              checked={audioHidden}
              disabled={target.audio === "forced"}
              onChange={(event) => toggleHideAudio(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                🎧 Ẩn thanh audio
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-300">
                  {HIDDEN_AUDIO_BONUS} XP & Xu
                </span>
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                Audio tự phát một lượt như thi thật, không tua hay dừng được. Phần Nghe được
                thưởng thêm {HIDDEN_AUDIO_BONUS} XP & Xu.
              </span>
              {target.audio === "forced" ? (
                <span className="mt-1 block text-xs font-medium text-primary">
                  Thầy đã bật chế độ này cho đề — em vẫn được thưởng.
                </span>
              ) : null}
            </span>
          </label>
        ) : null}

        <div className="mt-4 space-y-2">
          <form action={startPractice}>
            <input type="hidden" name="materialId" value={target.materialId} />
            <input type="hidden" name="unitId" value={target.unitId ?? ""} />
            <input type="hidden" name="restart" value={target.restart ? "1" : "0"} />
            <input type="hidden" name="hideAudio" value={asksAudio && audioHidden ? "1" : "0"} />
            <input type="hidden" name="timed" value="1" />
            <PracticeSubmitButton
              className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground"
              pendingLabel="Đang mở bài…"
            >
              {target.resume && !target.restart
                ? "Làm tiếp, giữ đồng hồ"
                : "Tính giờ như thi thật"}
            </PracticeSubmitButton>
          </form>

          <form action={startPractice}>
            <input type="hidden" name="materialId" value={target.materialId} />
            <input type="hidden" name="unitId" value={target.unitId ?? ""} />
            <input type="hidden" name="restart" value={target.restart ? "1" : "0"} />
            <input type="hidden" name="hideAudio" value={asksAudio && audioHidden ? "1" : "0"} />
            <input type="hidden" name="timed" value="0" />
            <PracticeSubmitButton
              className="w-full rounded-md border border-border px-3 py-2.5 text-sm font-semibold hover:border-primary"
              pendingLabel="Đang mở bài…"
            >
              {target.resume && !target.restart
                ? "Làm tiếp, bỏ đồng hồ"
                : "Không tính giờ"}
            </PracticeSubmitButton>
          </form>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Huỷ
        </button>
      </div>
    </div>,
    document.body
  );
}

// Cùng idiom với ActionSubmitButton (components/action-form.tsx): useFormStatus
// phải nằm TRONG <form> nên tách component con riêng, không dùng chung được với
// ActionSubmitButton vì action ở đây (startPractice) redirect thay vì trả
// ActionResult. Khoá nút trong lúc chờ để nhấp đúp không mở hai lượt tự luyện
// song song (đóng luôn cửa sổ race dẫn tới P2002 ở AssignmentRecipient).
function PracticeSubmitButton({
  className,
  pendingLabel,
  children
}: {
  className?: string;
  pendingLabel: string;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {/* Nút chữ thì thay chữ; nút là cả thẻ (thư viện kiểu chin) thì giữ bìa thẻ,
          phủ dòng "Đang mở bài…" lên trên. */}
      {typeof children === "string" ? (
        pending ? pendingLabel : children
      ) : (
        <>
          {children}
          {pending ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white">
              {pendingLabel}
            </span>
          ) : null}
        </>
      )}
    </button>
  );
}
