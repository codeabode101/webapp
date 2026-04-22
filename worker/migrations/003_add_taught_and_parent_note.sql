-- Add missing columns for analysis output
ALTER TABLE students_classes ADD COLUMN taught_methods TEXT;
ALTER TABLE students_classes ADD COLUMN needs_practice TEXT;
ALTER TABLE students_classes ADD COLUMN parent_note TEXT;