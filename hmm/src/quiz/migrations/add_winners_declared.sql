-- Migration: add winners_declared_at and winners_declared_by to quizzes
ALTER TABLE quizzes
  ADD COLUMN IF NOT EXISTS winners_declared_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS winners_declared_by INT REFERENCES users(id);
