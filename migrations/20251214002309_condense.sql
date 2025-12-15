UPDATE students_classes SET description = relevance WHERE status='completed';

ALTER TABLE students_classes DROP COLUMN relevance;
