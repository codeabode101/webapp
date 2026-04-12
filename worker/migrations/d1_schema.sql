-- Cloudflare D1 Schema (converted from PostgreSQL)
-- Run with: wrangler d1 execute webapp-db --file=./migrations/d1_schema.sql

CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    current_level TEXT NOT NULL,
    final_goal TEXT NOT NULL,
    future_concepts TEXT NOT NULL DEFAULT '[]',
    notes TEXT,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    current_class INTEGER,
    classes_used INTEGER DEFAULT 0,
    classes_paid INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS students_classes (
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    class_id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL,
    name TEXT NOT NULL,
    class_type TEXT,  -- "traditional" | "experimental" | "self_directed"
    class_date TEXT,   -- "2026-04-17"
    accomplished TEXT[], -- what was done in class (replaces taught_methods)
    relevance TEXT,
    methods TEXT NOT NULL DEFAULT '[]',
    stretch_methods TEXT,
    skills_tested TEXT,
    description TEXT,
    classwork TEXT,
    notes TEXT,
    hw TEXT,
    hw_notes TEXT
);

CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    work TEXT NOT NULL,
    work_type TEXT NOT NULL,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    class_id INTEGER NOT NULL REFERENCES students_classes(class_id),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    submission_id INTEGER REFERENCES submissions(id),
    error TEXT,
    interpretation TEXT,
    question TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    question_id INTEGER NOT NULL REFERENCES questions(id),
    comment TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER REFERENCES accounts(id),
    submission_id INTEGER REFERENCES submissions(id),
    title TEXT NOT NULL,
    description TEXT,
    deploy_method TEXT,
    status TEXT DEFAULT 'pending',
    views INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    build_log TEXT
);

CREATE INDEX IF NOT EXISTS idx_tokens_token ON tokens(token);
CREATE INDEX IF NOT EXISTS idx_tokens_expires ON tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_students_account ON students(account_id);
CREATE INDEX IF NOT EXISTS idx_submissions_class ON submissions(class_id);
CREATE INDEX IF NOT EXISTS idx_questions_submission ON questions(submission_id);
CREATE INDEX IF NOT EXISTS idx_comments_question ON comments(question_id);
