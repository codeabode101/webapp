ALTER TABLE students ADD COLUMN current_class INTEGER REFERENCES students_classes(class_id);
ALTER TABLE students ADD COLUMN step INTEGER NOT NULL DEFAULT 0;
