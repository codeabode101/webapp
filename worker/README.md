# Cloudflare Workers Deployment

## Setup

### 1. Create D1 Database
```bash
wrangler d1 create webapp-db
```
Copy the `database_id` output and update `wrangler.toml`.

### 2. Run Migrations
```bash
# Local dev
wrangler d1 execute webapp-db --file=./migrations/d1_schema.sql --local

# Remote (production)
wrangler d1 execute webapp-db --file=./migrations/d1_schema.sql --remote
```

### 3. Configure Build Server
Update `wrangler.toml` with your VPS endpoint:
```toml
[vars]
BUILD_SERVER_URL = "http://your-vps-ip:8090"
```

On your VPS, set up an endpoint that:
1. Receives `POST /build` with `{ project_id, work }`
2. Runs `pygbag` 
3. Uploads the build to R2 or a CDN
4. Updates project status via D1 API

### 4. Deploy
```bash
# Deploy Worker
npm run deploy:worker

# Deploy Frontend (to Cloudflare Pages)
npm run deploy:frontend
```

## Frontend API Configuration
Update `frontend/next.config.ts` with your Worker URL:
```ts
const nextConfig: NextConfig = {
  output: 'export',
  env: {
    API_URL: 'https://your-worker.your-subdomain.workers.dev',
  },
};
```

Update `frontend/lib/auth.tsx` to use the API URL:
```ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
```

## D1 Schema Differences from PostgreSQL
- Arrays stored as JSON strings
- Password hashing: bcrypt (not pgcrypto/digest)
- Tokens stored with ISO timestamp strings
- SERIAL → AUTOINCREMENT
- BYTEA → TEXT (stores bcrypt hash)
