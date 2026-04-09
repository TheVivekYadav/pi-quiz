/**
 * globalSetup.ts
 *
 * Runs once before all Playwright tests. Responsibilities:
 *   1. Connect to the E2E-isolated Postgres database.
 *   2. Initialize the full schema (idempotent — mirrors DatabaseService.initSchema).
 *   3. Seed the test admin and regular-user accounts.
 *   4. Truncate volatile tables so every test run starts from a clean slate.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '.env.e2e') });

const DB_URL =
  process.env.E2E_DB_URL ??
  'postgresql://pi_quiz:pi_quiz_password@localhost:5433/pi_quiz_e2e';

export default async function globalSetup() {
  const pool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 15_000 });

  try {
    await initSchema(pool);
    await seedUsers(pool);
    await truncateVolatileData(pool);
    console.log('[globalSetup] E2E database ready.');
  } finally {
    await pool.end();
  }
}

// ─── Schema ──────────────────────────────────────────────────────────────────

async function initSchema(pool: Pool) {
  // Users
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      roll_number TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      name TEXT,
      branch TEXT,
      year INTEGER,
      role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS branch TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS year INTEGER;`);

  // Sessions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      device_name TEXT,
      device_id TEXT,
      platform TEXT,
      ip_address TEXT,
      user_agent TEXT,
      is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
      blocked_reason TEXT,
      blocked_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Auth logs
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      session_id TEXT REFERENCES user_sessions(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Quizzes
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      topic TEXT NOT NULL,
      category TEXT NOT NULL,
      level TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      starts_at TIMESTAMPTZ NOT NULL,
      description TEXT,
      expectations TEXT,
      curator_note TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS winners_declared_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS winners_declared_by INT REFERENCES users(id);`);

  // Questions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      image_url TEXT,
      options JSONB NOT NULL DEFAULT '[]'::jsonb,
      correct_option_id TEXT NOT NULL,
      points INTEGER DEFAULT 1,
      question_index INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Forms
  await pool.query(`
    CREATE TABLE IF NOT EXISTS forms (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      fields JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS enrollment_form_id TEXT REFERENCES forms(id) ON DELETE SET NULL;
  `);

  // Enrollments
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quiz_enrollments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, quiz_id)
    );
  `);
  await pool.query(`ALTER TABLE quiz_enrollments ADD COLUMN IF NOT EXISTS attempts_count INTEGER NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE quiz_enrollments ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE quiz_enrollments ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE quiz_enrollments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;`);

  // Responses (form submissions)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS responses (
      id TEXT PRIMARY KEY,
      form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
      answers JSONB NOT NULL DEFAULT '{}'::jsonb,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    ALTER TABLE quiz_enrollments ADD COLUMN IF NOT EXISTS form_response_id TEXT REFERENCES responses(id) ON DELETE SET NULL;
  `);

  // Attempts
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      score INTEGER NOT NULL,
      total INTEGER NOT NULL,
      accuracy_rate NUMERIC NOT NULL,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Quiz responses (per-question answers)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quiz_responses (
      id TEXT PRIMARY KEY,
      attempt_id TEXT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL REFERENCES quiz_questions(id),
      selected_option_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Indexes
  const indexes: string[] = [
    'CREATE INDEX IF NOT EXISTS idx_responses_form_id ON responses(form_id);',
    'CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);',
    'CREATE INDEX IF NOT EXISTS idx_quiz_enrollments_user_id ON quiz_enrollments(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_quiz_enrollments_quiz_id ON quiz_enrollments(quiz_id);',
    'CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON quiz_attempts(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);',
    'CREATE INDEX IF NOT EXISTS idx_quiz_responses_attempt_id ON quiz_responses(attempt_id);',
    'CREATE INDEX IF NOT EXISTS idx_users_roll_number ON users(roll_number);',
    'CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);',
    'CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, revoked_at, is_blocked);',
    'CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id_created_at ON auth_logs(user_id, created_at DESC);',
  ];
  for (const sql of indexes) {
    await pool.query(sql);
  }
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seedUsers(pool: Pool) {
  // Admin user (same as production seed in DatabaseService)
  await pool.query(`
    INSERT INTO users (roll_number, email, name, role)
    VALUES ('ADMIN001', 'admin@quiz.local', 'Admin User', 'admin')
    ON CONFLICT (roll_number) DO NOTHING;
  `);

  // Regular test user
  await pool.query(`
    INSERT INTO users (roll_number, email, name, role)
    VALUES ('TESTUSER001', 'testuser@quiz.local', 'Test User', 'user')
    ON CONFLICT (roll_number) DO NOTHING;
  `);
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function truncateVolatileData(pool: Pool) {
  // Remove all quiz-related and session data so tests start clean.
  // Users themselves are kept (they're idempotently re-seeded).
  await pool.query(`
    TRUNCATE TABLE
      quiz_responses,
      quiz_attempts,
      quiz_enrollments,
      quiz_questions,
      responses,
      quizzes,
      forms,
      user_sessions,
      auth_logs
    RESTART IDENTITY CASCADE;
  `);
}
