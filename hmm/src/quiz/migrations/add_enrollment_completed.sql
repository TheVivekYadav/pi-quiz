-- Migration: add is_completed and completed_at to quiz_enrollments
ALTER TABLE quiz_enrollments
  ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
