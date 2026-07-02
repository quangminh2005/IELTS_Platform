-- Idempotent: them cot transcript cho ban ghi Speaking (tu chay khi build/deploy).
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "transcript" TEXT;
