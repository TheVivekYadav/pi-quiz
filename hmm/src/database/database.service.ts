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
        role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

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
        question_id TEXT NOT NULL REFERENCES quiz_questions(id),
        selected_option_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
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

    // Create indexes for performance
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_responses_form_id ON responses(form_id);',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);',
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
      'CREATE INDEX IF NOT EXISTS idx_quiz_responses_attempt_id ON quiz_responses(attempt_id);',
    );

    // Insert default admin user if not exists
    await this.pool.query(`
      INSERT INTO users (roll_number, email, name, role)
      VALUES ('ADMIN001', 'admin@quiz.local', 'Admin User', 'admin')
      ON CONFLICT (roll_number) DO NOTHING;
    `);
  }
}
