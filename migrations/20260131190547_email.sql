-- Homework_notes too when that part is updated
ALTER TABLE students_classes ADD COLUMN IF NOT EXISTS taught_methods TEXT[];
ALTER TABLE students_classes ADD COLUMN IF NOT EXISTS needs_practice TEXT[];

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email TEXT;

-- When there is a new class, vercel script will check this to see if the email should be sent on Thursday
ALTER TABLE students ADD COLUMN IF NOT EXISTS sent_email BOOLEAN NOT NULL DEFAULT FALSE;
