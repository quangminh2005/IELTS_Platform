import { redirect } from "next/navigation";
import { NoticeToast } from "@/components/notice-toast";
import { PracticeLibrary } from "@/components/practice-library";
import { auth } from "@/lib/auth";
import { onlyPracticeRecipient, parsePracticeScopeKey, practiceScopeKey } from "@/lib/practice";
import { bandScore } from "@/lib/band-score";
import {
  parseQuestionGroupParam,
  partNumberOf,
  practiceProgressLabel,
  questionGroupsOf,
  summarizePracticeAttempts,
  summarizeUnfinishedPractice,
  summarizeUnitProgress,
  type PracticeMaterialItem
} from "@/lib/practice-library";
import { prisma } from "@/lib/prisma";
import {
  getPracticeGoalStatus,
  syncPracticeGoal,
  type PracticeGoalStatus
} from "@/lib/practice-goal-data";

type StudentPracticePageProps = {
  searchParams?: {
    practiceMessage?: string;
    practiceStatus?: string;
    practiceNonce?: string;
    // Nhóm dạng câu lọc sẵn (link "Luyện dạng này" từ trang Tiến bộ).
    type?: string;
    // Kỹ năng mở sẵn (tab Nghe/Đọc/Viết/Nói), kiểu ?module= của chin.
    skill?: string;
  };
};

export default async function StudentPracticePage({ searchParams }: StudentPracticePageProps) {
  const practiceMessage = searchParams?.practiceMessage;
  const practiceStatus = searchParams?.practiceStatus === "success" ? "success" : "error";
  const practiceNonce = searchParams?.practiceNonce;
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "student") {
    redirect("/login");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });

  if (!student) {
    redirect("/waiting");
  }

  // Chỉ tiêu tự luyện tuần: ghi Xu còn thiếu rồi đọc tiến độ. Lỗi thì ẩn dòng tiến độ.
  let practiceGoal: PracticeGoalStatus | null = null;
  try {
    await syncPracticeGoal(student.id);
    practiceGoal = await getPracticeGoalStatus(student.id);
  } catch (error) {
    console.error("[chi-tieu-tu-luyen] trang tự luyện", error);
  }

  // select (KHÔNG include): content/transcript/metadataJson của unit rất nặng.
  const [materials, attempts, unfinishedAttempts, unitTypes] = await Promise.all([
    prisma.material.findMany({
      where: { practiceOpen: true },
      orderBy: [{ skill: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        skill: true,
        sourceLabel: true,
        bookName: true,
        practiceLockAudio: true,
        units: {
          orderBy: [{ unitNumber: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            title: true,
            skill: true,
            audioUrl: true,
            _count: { select: { questions: true } }
          }
        }
      }
    }),
    prisma.attempt.findMany({
      where: {
        studentId: student.id,
        status: { in: ["submitted", "reviewed"] },
        assignmentRecipient: onlyPracticeRecipient
      },
      select: {
        id: true,
        score: true,
        submittedAt: true,
        assignmentRecipient: {
          select: { assignment: { select: { practiceScopeKey: true } } }
        }
      }
    }),
    // Lượt còn dở: quyết định thẻ hiện "Làm tiếp" hay "Luyện", và hộp thoại hỏi câu
    // nào. Lấy luôn skillTimeLimitsJson vì lượt dở CÓ đồng hồ là trường hợp duy nhất
    // còn phải hỏi (để học viên gỡ được đồng hồ nếu muốn).
    prisma.attempt.findMany({
      where: {
        studentId: student.id,
        status: "in_progress",
        assignmentRecipient: onlyPracticeRecipient
      },
      select: {
        assignmentRecipient: {
          select: {
            assignment: { select: { practiceScopeKey: true, skillTimeLimitsJson: true } }
          }
        }
      }
    }),
    // Dạng câu của từng phần — groupBy chỉ trả cặp (phần, dạng), không kéo nội dung
    // câu hỏi (vài đề LPTD có hàng nghìn câu).
    prisma.question.groupBy({
      by: ["assignableUnitId", "questionType"],
      where: { assignableUnit: { material: { practiceOpen: true } } }
    })
  ]);

  // Số câu đúng theo (lượt, phần) — để thẻ Part in "Đã làm 7/10" kể cả khi học viên
  // luyện cả đề. groupBy chỉ trả con số, không kéo nội dung câu trả lời.
  const correctRows =
    attempts.length > 0
      ? await prisma.answer.groupBy({
          by: ["attemptId", "assignableUnitId"],
          where: { attemptId: { in: attempts.map((attempt) => attempt.id) }, isCorrect: true },
          _count: { _all: true }
        })
      : [];
  const correctByAttempt = new Map<string, Record<string, number>>();
  for (const row of correctRows) {
    const byUnit = correctByAttempt.get(row.attemptId) ?? {};
    byUnit[row.assignableUnitId] = row._count._all;
    correctByAttempt.set(row.attemptId, byUnit);
  }

  const unitProgress = summarizeUnitProgress(
    attempts.map((attempt) => ({
      practiceScopeKey: attempt.assignmentRecipient.assignment.practiceScopeKey,
      correctByUnit: correctByAttempt.get(attempt.id) ?? {}
    })),
    new Map(materials.map((material) => [material.id, material.units.map((unit) => unit.id)]))
  );

  // Ngày nộp gần nhất theo đề (dòng "Lần gần nhất" trên thẻ full test).
  const lastByMaterial = new Map<string, Date>();
  for (const attempt of attempts) {
    const scope = parsePracticeScopeKey(attempt.assignmentRecipient.assignment.practiceScopeKey);
    if (!scope || !attempt.submittedAt) continue;
    const previous = lastByMaterial.get(scope.materialId);
    if (!previous || attempt.submittedAt > previous) {
      lastByMaterial.set(scope.materialId, attempt.submittedAt);
    }
  }

  const typesByUnit = new Map<string, string[]>();
  for (const row of unitTypes) {
    const list = typesByUnit.get(row.assignableUnitId) ?? [];
    list.push(row.questionType);
    typesByUnit.set(row.assignableUnitId, list);
  }

  // Gộp số lượt và điểm cao nhất theo từng đề (chỉ lượt luyện CẢ ĐỀ mới tính vào
  // điểm cao nhất — xem summarizePracticeAttempts).
  const progressByMaterial = summarizePracticeAttempts(
    attempts.map((attempt) => ({
      practiceScopeKey: attempt.assignmentRecipient.assignment.practiceScopeKey,
      score: attempt.score
    }))
  );

  const unfinishedByScope = summarizeUnfinishedPractice(
    unfinishedAttempts.map((attempt) => ({
      practiceScopeKey: attempt.assignmentRecipient.assignment.practiceScopeKey,
      skillTimeLimitsJson: attempt.assignmentRecipient.assignment.skillTimeLimitsJson
    }))
  );

  // Đề chưa có phần nào (giáo viên bật "Cho tự luyện" trước khi thêm phần) không
  // có gì để bấm vào luyện — lọc bỏ ngay ở đây thay vì bày ra thứ mà bấm vào là
  // văng lỗi (startPractice cũng tự chặn units.length === 0, đây là lớp lọc UI
  // cho tình huống thường gặp).
  const items: PracticeMaterialItem[] = materials
    .filter((material) => material.units.length > 0)
    .map((material) => {
      const questionCount = material.units.reduce(
        (total, unit) => total + unit._count.questions,
        0
      );
      const progress = progressByMaterial.get(material.id);
      const unitHasAudio = (unit: (typeof material.units)[number]) =>
        unit.skill === "listening" && Boolean(unit.audioUrl);

      const bestCorrect = progress?.bestCorrect ?? null;

      return {
        id: material.id,
        title: material.title,
        skill: material.skill,
        sourceLabel: material.sourceLabel,
        book: material.bookName?.trim() || material.sourceLabel?.trim() || "Đề khác",
        rounds: progress?.rounds ?? 0,
        bestCorrect,
        band: bestCorrect === null ? null : bandScore(material.skill, bestCorrect, questionCount),
        lastPracticedAt: lastByMaterial.get(material.id)?.toISOString() ?? null,
        unitCount: material.units.length,
        questionCount,
        progressLabel: practiceProgressLabel(
          progress?.rounds ?? 0,
          progress?.bestCorrect ?? null,
          questionCount
        ),
        hasAudio: material.units.some(unitHasAudio),
        lockAudioForced: material.practiceLockAudio,
        resume: unfinishedByScope.get(practiceScopeKey(student.id, material.id, null)) ?? null,
        questionGroups: questionGroupsOf(
          material.units.flatMap((unit) => typesByUnit.get(unit.id) ?? [])
        ),
        units: material.units.map((unit) => {
          const groups = questionGroupsOf(typesByUnit.get(unit.id) ?? []);
          const done = unitProgress.get(unit.id);
          return {
            id: unit.id,
            title: unit.title,
            questionCount: unit._count.questions,
            hasAudio: unitHasAudio(unit),
            resume:
              unfinishedByScope.get(practiceScopeKey(student.id, material.id, unit.id)) ?? null,
            questionGroups: groups,
            partNumber: partNumberOf(unit.title),
            rounds: done?.rounds ?? 0,
            // Phần chấm tay (Viết/Nói) không có nhóm dạng câu tự chấm -> không in điểm.
            bestCorrect: done && groups.length > 0 ? done.bestCorrect : null
          };
        })
      };
    });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Tự luyện</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chọn một đề để luyện thêm. Làm lại bao nhiêu lần cũng được — mỗi lần đều có
          kết quả và giải thích ngay sau khi nộp.
        </p>
      </header>
      {practiceGoal && practiceGoal.goal > 0 && practiceGoal.current ? (
        <p className="rounded-lg border border-border bg-card px-4 py-2 text-sm">
          🎯 Tuần này:{" "}
          <strong className="tabular-nums">
            {practiceGoal.current.done}/{practiceGoal.goal}
          </strong>{" "}
          phần
          {practiceGoal.current.met
            ? " — đã đạt chỉ tiêu ✓"
            : " — mỗi phần làm ít nhất 3 phút và trả lời từ một nửa số câu"}
        </p>
      ) : null}
      {/* key=practiceNonce: ép NoticeToast mount lại mỗi lần có thông báo mới, kể
          cả khi hai lần lỗi liên tiếp trùng y nội dung — nếu không, effect bên
          trong so theo message/status không thấy gì đổi nên toast lần hai sẽ
          không hiện lại. */}
      <NoticeToast key={practiceNonce} message={practiceMessage} status={practiceStatus} />
      <PracticeLibrary
        items={items}
        initialGroup={parseQuestionGroupParam(searchParams?.type)}
        initialSkill={searchParams?.skill}
        noticeMessage={practiceMessage}
        noticeNonce={practiceNonce}
      />
    </div>
  );
}
