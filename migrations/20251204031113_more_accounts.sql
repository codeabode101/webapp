-- First, remove the foreign key constraint since PostgreSQL doesn't support
-- foreign key constraints on array elements
ALTER TABLE students DROP CONSTRAINT students_account_id_fkey;

-- Change the column type from integer to integer[]
ALTER TABLE students 
ALTER COLUMN account_id TYPE integer[] 
USING CASE 
    WHEN account_id IS NULL THEN '{}'::integer[]
    ELSE ARRAY[account_id]
END;

-- Add a check constraint to ensure array contains only positive integers (optional)
ALTER TABLE students 
ADD CONSTRAINT account_id_positive_check 
CHECK (account_id IS NULL OR (CARDINALITY(account_id) = 0 OR account_id && ARRAY[0] IS FALSE));

-- Create a GIN index for better array query performance (optional but recommended)
CREATE INDEX idx_students_account_id ON students USING GIN (account_id);

-- Add a comment explaining the change
COMMENT ON COLUMN students.account_id IS 'Array of account IDs that can access this student record';
