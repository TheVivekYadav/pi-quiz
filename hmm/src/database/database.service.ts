import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor() {
    const connectionString =
      process.env.DATABASE_URL ??
      'postgresql://pi_quiz:pi_quiz_password@localhost:5432/pi_quiz';

    this.pool = new Pool({
      connectionString,
      max: Number(process.env.DB_POOL_MAX ?? 50),
      idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
      connectionTimeoutMillis: 5000,
    });
  }

  async onModuleInit() {
    await this.initSchema();
    this.logger.log('PostgreSQL connected and schema initialized');
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  getPool() {
    return this.pool;
  }

  private async initSchema() {
    // Users table
    await this.pool.query(`
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

    // Backward-compatible user metadata columns
    await this.pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS branch TEXT;`);
    await this.pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS year INTEGER;`);

    // Persistent auth sessions table
    await this.pool.query(`
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

    // Structured auth logs
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS auth_logs (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        session_id TEXT REFERENCES user_sessions(id) ON DELETE SET NULL,
        event_type TEXT NOT NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // App settings table for runtime feature flags/configuration
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // API error logs for admin observability
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS api_error_logs (
        id BIGSERIAL PRIMARY KEY,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        message TEXT NOT NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        resolved BOOLEAN NOT NULL DEFAULT FALSE,
        resolved_at TIMESTAMPTZ,
        resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await this.pool.query(`ALTER TABLE api_error_logs ADD COLUMN IF NOT EXISTS resolved BOOLEAN NOT NULL DEFAULT FALSE;`);
    await this.pool.query(`ALTER TABLE api_error_logs ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;`);
    await this.pool.query(`ALTER TABLE api_error_logs ADD COLUMN IF NOT EXISTS resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL;`);

    // Quizzes table
    await this.pool.query(`
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
        image_mode TEXT NOT NULL DEFAULT 'banner',
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Quiz questions table
    await this.pool.query(`
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

    // Quiz enrollments table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS quiz_enrollments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, quiz_id)
      );
    `);

    // Add lockout and attempt tracking to enrollments
    await this.pool.query(`ALTER TABLE quiz_enrollments ADD COLUMN IF NOT EXISTS attempts_count INTEGER NOT NULL DEFAULT 0;`);
    await this.pool.query(`ALTER TABLE quiz_enrollments ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;`);

    // Add completion tracking to enrollments
    await this.pool.query(`ALTER TABLE quiz_enrollments ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT FALSE;`);
    await this.pool.query(`ALTER TABLE quiz_enrollments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;`);

    // Quiz attempts table
    await this.pool.query(`
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

    // Quiz responses table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS quiz_responses (
        id TEXT PRIMARY KEY,
        attempt_id TEXT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
        question_id TEXT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
        selected_option_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Ensure deleting questions/quizzes also deletes dependent responses
    await this.pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'quiz_responses_question_id_fkey'
            AND table_name = 'quiz_responses'
        ) THEN
          ALTER TABLE quiz_responses DROP CONSTRAINT quiz_responses_question_id_fkey;
        END IF;
      EXCEPTION WHEN undefined_table THEN
        NULL;
      END
      $$;
    `);
    await this.pool.query(`
      ALTER TABLE quiz_responses
      ADD CONSTRAINT quiz_responses_question_id_fkey
      FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE;
    `);

    // Forms and responses (existing)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS forms (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        fields JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS responses (
        id TEXT PRIMARY KEY,
        form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        answers JSONB NOT NULL DEFAULT '{}'::jsonb,
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Add winners tracking to quizzes
    await this.pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS winners_declared_at TIMESTAMPTZ;`);
    await this.pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS winners_declared_by INT REFERENCES users(id);`);
    await this.pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS image_url TEXT;`);
    await this.pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS image_mode TEXT NOT NULL DEFAULT 'banner';`);
    await this.pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT TRUE;`);
    await this.pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS enrollment_enabled BOOLEAN NOT NULL DEFAULT TRUE;`);
    await this.pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS enrollment_starts_at TIMESTAMPTZ;`);
    await this.pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS short_id TEXT;`);

    // Backfill short IDs for older quizzes (4-digit, unique)
    await this.pool.query(`
      DO $$
      DECLARE
        rec RECORD;
        candidate TEXT;
      BEGIN
        FOR rec IN SELECT id FROM quizzes WHERE short_id IS NULL LOOP
          LOOP
            candidate := LPAD((FLOOR(RANDOM() * 9000) + 1000)::INT::TEXT, 4, '0');
            EXIT WHEN NOT EXISTS (SELECT 1 FROM quizzes WHERE short_id = candidate);
          END LOOP;

          UPDATE quizzes
          SET short_id = candidate
          WHERE id = rec.id;
        END LOOP;
      END
      $$;
    `);

    // Add attendance tracking support
    await this.pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS attendance_required BOOLEAN NOT NULL DEFAULT FALSE;`);

    // Attendance tokens generated by admins for QR check-in
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS quiz_attendance_tokens (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Records of users who have checked in via QR code
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS quiz_checkins (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_id TEXT REFERENCES quiz_attendance_tokens(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(quiz_id, user_id)
      );
    `);

    // Link enrollment form to quiz (nullable — a quiz may have no registration form)
    await this.pool.query(`
      ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS enrollment_form_id TEXT REFERENCES forms(id) ON DELETE SET NULL;
    `);

    // Track which form response a user submitted when enrolling
    await this.pool.query(`
      ALTER TABLE quiz_enrollments ADD COLUMN IF NOT EXISTS form_response_id TEXT REFERENCES responses(id) ON DELETE SET NULL;
    `);

    // Create indexes for performance
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_responses_form_id ON responses(form_id);',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);',
    );
    await this.pool.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_quizzes_short_id_unique ON quizzes(short_id);',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_quiz_enrollments_user_id ON quiz_enrollments(user_id);',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_quiz_enrollments_quiz_id ON quiz_enrollments(quiz_id);',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON quiz_attempts(user_id);',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id_submitted ON quiz_attempts(quiz_id, submitted_at DESC);',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_quiz_responses_attempt_id ON quiz_responses(attempt_id);',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_users_roll_number ON users(roll_number);',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, revoked_at, is_blocked);',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id_created_at ON auth_logs(user_id, created_at DESC);',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_api_error_logs_created_at ON api_error_logs(created_at DESC);',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_api_error_logs_status_created_at ON api_error_logs(status_code, created_at DESC);',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_api_error_logs_resolved_created_at ON api_error_logs(resolved, created_at DESC);',
    );

    // Insert default admin user if not exists
    await this.pool.query(`
      INSERT INTO users (roll_number, email, name, role)
      VALUES ('ADMIN001', 'admin@quiz.local', 'Admin User', 'admin')
      ON CONFLICT (roll_number) DO NOTHING;
    `);
  }
}
