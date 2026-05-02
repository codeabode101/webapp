-- Migrate submissions table to make class_id nullable and add 'standalone' work_type
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS submissions_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    work TEXT NOT NULL,
    work_type TEXT NOT NULL,
    account_id INTEGER REFERENCES accounts(id),
    class_id INTEGER REFERENCES students_classes(class_id),
    created_at TEXT DEFAULT (datetime('now'))
);

-- Insert existing data (skip created_at to avoid missing column errors, uses default)
INSERT INTO submissions_new (id, work, work_type, account_id, class_id)
SELECT id, work, work_type, account_id, class_id FROM submissions;

DROP TABLE submissions;
ALTER TABLE submissions_new RENAME TO submissions;

CREATE INDEX IF NOT EXISTS idx_submissions_class ON submissions(class_id);

PRAGMA foreign_keys = ON;
