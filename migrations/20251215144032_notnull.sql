UPDATE students_classes 
SET description = '' 
WHERE description IS NULL;

UPDATE students_classes 
SET methods = ARRAY[''] 
WHERE methods IS NULL;

ALTER TABLE students_classes
ALTER COLUMN methods SET NOT NULL;

ALTER TABLE students_classes
ALTER COLUMN description SET NOT NULL;
