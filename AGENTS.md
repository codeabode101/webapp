# Codeabode Agents Documentation

## Overview
Codeabode is a platform for teaching programming to students. It manages students, classes, submissions, projects, and builds them for the web.

## Architecture

### Components
1. **Frontend** (`/home/sigma/webapp/frontend`) - Next.js app for teachers/students
2. **Worker** (`/home/sigma/webapp/worker`) - Cloudflare Workers backend (D1 database)
3. **CLI** (`/home/sigma/webapp/cli`) - CLI tool for managing students/curriculum
4. **Build Server** (`/home/sigma/webapp/server`) - Python server for building Java/Python projects
5. **Landing Page** (`/home/sigma/webapp/landing-page`) - Marketing site

## Database (Cloudflare D1)

### Tables
- `accounts` - Teacher accounts (id, name, username, password)
- `students` - Student records (id, name, age, current_level, final_goal, future_concepts, notes, account_id, current_class)
- `students_classes` - Class records (student_id, status, name, class_type, class_date, accomplished, methods, stretch_methods, description, classwork, notes, hw, hw_notes)
- `tokens` - Session tokens (token, user_id, expires_at)
- `submissions` - Student work submissions (work, work_type, account_id, class_id, created_at)
- `questions` - Student questions about their work
- `comments` - Teacher responses to questions
- `projects` - Published projects (account_id, submission_id, title, description, deploy_method, status, views, created_at, build_log)

### Key Status Values
- `projects.status`: 'pending' | 'building' | 'ready' | 'failed'

## Build System

### Flow
1. Student submits work (classwork/homework)
2. Teacher publishes project via `/api/submit_project`
3. Worker fetches submission code and calls build server
4. Build server detects language and builds:
   - **Java**: Compiles with javac, creates JAR with correct Main-Class, serves via CheerpJ
   - **Python**: Builds with pygbag (WebAssembly)
5. Build server updates project status via PATCH `/api/projects/{id}/status`

### Build Server (`/home/sigma/webapp/server/build_server.py`)
- Runs on `iloveuvania.omraheja.me:3000`
- Behind nginx proxy at `/build`
- **Critical**: Java class naming - the public class name must match the JAR manifest Main-Class
- Uses CheerpJ CDN for Java in browser: `https://cjrtnc.leaningtech.com/4.2/loader.js`

### Common Build Issues
1. **Wrong class name**: If code has `public class FishGame`, filename must be `FishGame.java` and manifest must have `Main-Class: FishGame`
2. **Build not triggering**: Check worker logs for `SubmitProject:` messages
3. **Project not showing**: Ensure status is 'ready' in database

## API Endpoints

### Worker (api.codeabode.co)
- `POST /api/login` - Login
- `POST /api/reset-password` - Reset password
- `POST /api/list_students` - List students for account
- `POST /api/get_student/{id}` - Get student details
- `POST /api/submit/{work_type}` - Submit classwork/homework
- `POST /api/ask` - Submit question
- `POST /api/comment` - Add comment
- `GET /api/get_questions` - Get all questions
- `POST /api/submit_project` - Publish project (triggers build)
- `GET /api/projects` - List ready projects
- `GET /api/projects/all` - List all projects
- `PATCH /api/projects/{id}/status` - Update project status (used by build server)
- `POST /api/projects/{id}/view` - Increment view count
- `GET /api/courses` - Get course content

### Build Server
- `POST /build` - Build project (requires `X-Build-Key: codeabode-build-secret-2026`)

## SSH Access
- Build server: `ubuntu@iloveuvania.omraheja.me`
- Projects directory: `/var/www/games/{project_id}/`
- Build output: `/var/www/games/{project_id}/build/web/`

## Testing with Playwright
Run Playwright tests against the build to verify Java games work in browser with CheerpJ.

## Key Files
- `worker/src/index.ts` - Main worker handler
- `worker/migrations/d1_schema.sql` - Database schema
- `server/build_server.py` - Build server
- `frontend/app/projects/page.tsx` - Project listing
- `frontend/app/publish/page.tsx` - Publish form