--- Add status column (pending, building, ready, failed)
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
-- Add views counter
ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0,
-- Add build log for errors (optional)
ADD COLUMN IF NOT EXISTS build_log TEXT,
-- add method for deploying. some projects dont need deployed
ADD COLUMN IF NOT EXISTS deploy_method TEXT DEFAULT 'pygbag',
-- we dont need path since its automatically determined
DROP COLUMN IF EXISTS path;
