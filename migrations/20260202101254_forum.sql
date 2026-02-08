CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
    hw TEXT REFERENCES students_classes(hw) ON DELETE SET NULL,
    error TEXT,
    interpretation TEXT,
    question TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
    question_id INTEGER REFERENCES questions(id) ON DELETE SET NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
);
