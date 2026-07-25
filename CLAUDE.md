# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An IELTS class platform (a small computer-based-test practice tool) for one teacher and their students. Teachers build materials, assign them to classes, and review submissions; students take timed tests and see results. The UI and code comments are in **Vietnamese** — match that when writing user-facing strings and comments.

## Commands

Package manager is **pnpm**. Node/npm/pnpm and Python are on PATH — builds and tests run in-session.

```bash
pnpm dev                 # next dev (localhost:3000)
pnpm build               # prisma generate && next build
pnpm lint                # next lint (eslint next/core-web-vitals)
pnpm test                # vitest run (unit tests in tests/)
pnpm test:e2e            # playwright
pnpm prisma:migrate      # prisma migrate dev
pnpm prisma:seed         # tsx prisma/seed.ts — demo teacher/student + materials
npx vitest run tests/grading.test.ts   # single test file
```

Seeded demo accounts: `teacher@example.com` / `teacher123`, `student@example.com` / `student123`.

## Stack & deployment

- **Next.js 14 App Router**, React 18, TypeScript `strict`. Path alias `@/*` → repo root.
- **Prisma + PostgreSQL** (Neon). `DATABASE_URL` in `.env` (gitignored). SQLite `file:./dev.db` is a commented-out fallback.
- **NextAuth v4** (JWT sessions). Tailwind CSS. **Vercel Blob** for audio/image storage.
- Deploys to **Vercel**, region `sin1` (see `vercel.json`). Pushes to `feature/ielts-platform-mvp` auto-deploy.

## Architecture

### Roles & auth (`lib/auth.ts`)
Two roles stored as `User.role` (`"teacher"` | `"student"`).
- **Teachers** log in with email/password (`CredentialsProvider`, bcrypt).
- **Students** log in with **Google only** — and only if a `StudentProfile` with their email already exists (teacher pre-registers them). Unknown Google users are redirected to `/waiting`. First Google login links `StudentProfile.userId` to the new `User`.
- `role` is carried on the JWT/session. `auth()` wraps `getServerSession`. Server actions gate access with `requireTeacher()` (`lib/actions/classes.ts`) and `requireStudent()` (`lib/actions/attempts.ts`) — always call these first in an action.

### Routing (`app/`)
Route groups by role: `app/(auth)/` (login, waiting), `app/student/`, `app/teacher/`. Each role has its own `layout.tsx`. Pages are server components that read via Prisma and render client components from `components/`.

### Server actions (`lib/actions/*`)
All mutations live here as `"use server"` functions (classes, materials, assignments, attempts, reviews, annotations, comment-snippets). They validate input with **zod**, enforce role ownership, mutate via Prisma `$transaction`, then `revalidatePath` / `redirect`. Forms in components post `FormData` directly to these actions.

### Data model (`prisma/schema.prisma`)
Enums are modeled as **plain `String` columns**, not Prisma enums — the valid values are documented in the comment block at the top of the schema (roles, skills, unit types, assignment modes, statuses, submit reasons). When adding a status/type value, update that comment and any zod enum that mirrors it.

Content hierarchy: `Material` → `AssignableUnit` (one skill part: a reading passage, listening part, writing/speaking task) → `Question`. A `Question` stores `optionsJson` / `correctAnswerJson` as JSON strings. To give students work: `Assignment` → `AssignmentUnit` (picks units) + `AssignmentRecipient` (picks students) → `Attempt` → `Answer`. `Highlight` and `AnswerAnnotation` support in-test highlighting and teacher inline notes.

### The attempt/grading flow (`lib/actions/attempts.ts`, `lib/grading.ts`, `lib/band-score.ts`)
- **One attempt per assignment** — `startAttempt` never creates a second attempt; it resumes the existing one or (if submitted) the results page takes over. `resetRecipientAttempts` (teacher) is the only way to redo, and it cascades-deletes.
- **Auto-timeout submits are rejected on purpose** — `submitSkill` ignores `submitReason: "auto_timeout"` (guard against stale client code). Only student-clicked `"manual"` submits count.
- **Grading split by skill**: listening/reading are auto-graded (`gradeAnswer` normalizes case/whitespace and matches against accepted answers). **Writing/speaking are manual** — answers are stored with `isCorrect: null` ("chờ chấm"), excluded from the auto score, and graded later by the teacher in `TeacherReview`.
- **Band conversion** (`band-score.ts`) only applies to a **full 40-question** listening/reading test; partial tests return `null` band and show only percent + raw correct count.

### Importing materials (JSON)
Teachers bulk-import Cambridge tests as JSON via `/teacher/materials` (Import block) → `importMaterial` action. The exact schema and the AI-transcription prompt used to produce those files are in [docs/prompt-import-reading.md](docs/prompt-import-reading.md). Sample import payloads live in `tmp/`. Import validates that MC / true-false answers are within `options`.

### Media upload
Audio/image upload to Vercel Blob two ways: **server-proxied** (`app/api/*/direct-upload`, ~4.5MB serverless body limit) and **client-direct** (`app/api/audio/upload` via `@vercel/blob/client` `handleUpload`). Both require teacher role and use `BLOB_READ_WRITE_TOKEN`.

## Testing
Unit tests (`tests/`, vitest) are largely **structural/behavioral assertions over source files and pure logic** — e.g. `foundation.test.ts` greps `schema.prisma` and `seed.ts` for required models/fields. If you rename a model, field, seeded value, or change grading/band/deadline logic, expect these to fail and update them intentionally. `vitest.config.ts` sets the `@` alias.

## Conventions
- Keep user-facing text and code comments in Vietnamese, consistent with the existing files.
- Every server action starts with a `requireTeacher()`/`requireStudent()` ownership check — never trust `FormData` ids without scoping the Prisma query to the authenticated user.
- **Pages** under `app/teacher/` use `requireTeacherPage()` (`lib/teacher-page.ts`) instead — it redirects to `/login`, whereas `requireTeacher()` throws and would show visitors a raw server-error screen. Actions keep `requireTeacher()`. `tests/teacher-page-guard.test.ts` enforces this for every `page.tsx` under `app/teacher/`.
- When adding a String-enum value, keep three places in sync: the schema comment, the zod `z.enum(...)` in the relevant action, and any structural test that lists it.
