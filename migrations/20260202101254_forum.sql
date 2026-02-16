CREATE TABLE IF NOT EXISTS submissions (
	id SERIAL PRIMARY KEY,
    -- to see if teacher made changes
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
	class_id INTEGER REFERENCES students_classes(class_id) ON DELETE SET NULL,
	work TEXT NOT NULL,
	time TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL,
    work_type TEXT NOT NULL CHECK (work_type IN ('classwork', 'homework'))
);

INSERT INTO submissions (class_id, work, work_type)
SELECT
    class_id,
    classwork_submission,
    'classwork'
FROM students_classes
WHERE classwork_submission IS NOT NULL;

INSERT INTO submissions (class_id, work, work_type)
SELECT
    class_id,
    homework_submission,
    'homework'
FROM students_classes
WHERE homework_submission IS NOT NULL;

ALTER TABLE students_classes 
DROP COLUMN classwork_submission,
DROP COLUMN homework_submission;

CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL, 
    submission_id INTEGER REFERENCES submissions(id) ON DELETE SET NULL,
    error TEXT,
    interpretation TEXT,
    question TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    question_id INTEGER REFERENCES questions(id) ON DELETE SET NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL, -- account its published from
    submission_id INTEGER REFERENCES submissions(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    -- where the compiled webassembly is hosted (so we can iframe it)
    path TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
);
