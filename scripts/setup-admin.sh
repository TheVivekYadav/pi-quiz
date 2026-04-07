#!/bin/bash

# Admin Setup Script - Create initial quiz data in the database

DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-pi_quiz}
DB_USER=${DB_USER:-pi_quiz}
DB_PASSWORD=${DB_PASSWORD:-pi_quiz_password}

export PGPASSWORD=$DB_PASSWORD

echo "=== PI Quiz Admin Setup ==="
echo "Connecting to PostgreSQL database: $DB_NAME"

# Function to run SQL
run_sql() {
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "$1"
}

# 1. Create an admin user if not exists
echo "Creating admin user..."
run_sql "INSERT INTO users (roll_number, email, name, role)
         VALUES ('ADMIN001', 'admin@quiz.local', 'Quiz Administrator', 'admin')
         ON CONFLICT (roll_number) DO NOTHING;"

# 2. Create sample quizzes
echo "Creating sample quizzes..."
run_sql "INSERT INTO quizzes (id, title, topic, category, level, duration_minutes, starts_at, description, expectations, curator_note, created_by)
         VALUES (
           'gk-001',
           'General Knowledge Basics',
           'General Knowledge',
           'Trivia',
           'Beginner',
           30,
           NOW() + INTERVAL '1 hour',
           'Test your basic knowledge across various domains',
           'Covers history, geography, science, and culture',
           'Perfect for beginners to build foundational knowledge',
           1
         ),
         (
           'sci-101',
           'Introduction to Physics',
           'Physics',
           'Science',
           'Intermediate',
           45,
           NOW() + INTERVAL '2 hours',
           'Explore fundamental physics concepts',
           'From mechanics to thermodynamics',
           'Hands-on learning for curious minds',
           1
         )
         ON CONFLICT (id) DO NOTHING;"

# 3. Create questions for GK quiz
echo "Creating questions for GK quiz..."
run_sql "INSERT INTO quiz_questions (id, quiz_id, question_text, question_index, options, correct_option_id, points)
         VALUES (
           'gk-001-q1',
           'gk-001',
           'What is the capital of France?',
           1,
           '[{\"id\": \"a\", \"label\": \"London\"}, {\"id\": \"b\", \"label\": \"Paris\"}, {\"id\": \"c\", \"label\": \"Berlin\"}, {\"id\": \"d\", \"label\": \"Madrid\"}]'::jsonb,
           'b',
           10
         ),
         (
           'gk-001-q2',
           'gk-001',
           'Which planet is known as the Red Planet?',
           2,
           '[{\"id\": \"a\", \"label\": \"Venus\"}, {\"id\": \"b\", \"label\": \"Mars\"}, {\"id\": \"c\", \"label\": \"Jupiter\"}, {\"id\": \"d\", \"label\": \"Saturn\"}]'::jsonb,
           'b',
           10
         )
         ON CONFLICT (id) DO NOTHING;"

# 4. Create questions for Physics quiz
echo "Creating questions for Physics quiz..."
run_sql "INSERT INTO quiz_questions (id, quiz_id, question_text, question_index, options, correct_option_id, points)
         VALUES (
           'sci-101-q1',
           'sci-101',
           'What is the SI unit of force?',
           1,
           '[{\"id\": \"a\", \"label\": \"Kilogram\"}, {\"id\": \"b\", \"label\": \"Newton\"}, {\"id\": \"c\", \"label\": \"Joule\"}, {\"id\": \"d\", \"label\": \"Watt\"}]'::jsonb,
           'b',
           10
         ),
         (
           'sci-101-q2',
           'sci-101',
           'What is the speed of light in vacuum?',
           2,
           '[{\"id\": \"a\", \"label\": \"3 x 10^8 m/s\"}, {\"id\": \"b\", \"label\": \"3 x 10^7 m/s\"}, {\"id\": \"c\", \"label\": \"3 x 10^9 m/s\"}, {\"id\": \"d\", \"label\": \"3 x 10^6 m/s\"}]'::jsonb,
           'a',
           10
         )
         ON CONFLICT (id) DO NOTHING;"

echo "=== Setup Complete ==="
echo ""
echo "Admin User:"
echo "  Roll Number: ADMIN001"
echo "  Email: admin@quiz.local"
echo ""
echo "Sample Quizzes Created:"
echo "  1. General Knowledge Basics (gk-001)"
echo "  2. Introduction to Physics (sci-101)"
echo ""
echo "Next steps:"
echo "1. Start the backend server: npm run start:dev (in /hmm directory)"
echo "2. Start the frontend: npm run start (in /hmmm directory)"
echo "3. Login with a roll number (e.g., 21BCS001)"
echo "4. First-time users are automatically registered"
