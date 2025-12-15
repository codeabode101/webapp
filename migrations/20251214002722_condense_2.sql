UPDATE students_classes SET methods=skills_tested WHERE status='assessment';

ALTER TABLE students_classes DROP COLUMN skills_tested;
