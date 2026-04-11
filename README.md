# Codeabode Web App

Next.js + Cloudflare Workers app for managing student coding curriculum and publishing pygame projects.

## Architecture

```
webapp/
├── frontend/          # Next.js app (Cloudflare Pages)
├── worker/            # Cloudflare Worker (API)
└── server/            # Python build server (VPS)
```

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS
- **API**: Cloudflare Workers (D1 database)
- **Build Server**: Python + pygbag (VPS at iloveuvania.omraheja.me)
- **Hosting**: Cloudflare (frontend + worker), self-hosted VPS (builds)

## Auto-Deploy Flow

```
Student publishes project
        ↓
Worker creates project (status: building)
        ↓
Worker fetches code from submission
        ↓
Worker POSTs to build server
        ↓
Build server runs pygbag
        ↓
Build server updates project status to "ready"
        ↓
Project shows in projects list
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/login` | POST | User authentication |
| `/api/list_students` | POST | Get students for user |
| `/api/submit_project` | POST | Publish a project |
| `/api/projects` | GET | List ready projects |
| `/api/projects/all` | GET | List all projects |
| `/api/projects/{id}/status` | PATCH | Update project status |

## Setup

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Worker
```bash
cd worker
npx wrangler deploy
```

### Build Server (VPS)
```bash
# Copy build_server.py to VPS
# Run as systemd service:
sudo cp build_server.py /home/ubuntu/
sudo cp build-server.service /etc/systemd.system/
sudo systemctl enable --now build-server
```

## Environment Variables

**Worker** (`wrangler.toml`):
- `BUILD_SERVER_URL` - URL of the build server

**Nginx** - Proxy `/build` to port 3000

## Key Files

- `worker/src/index.ts` - All API endpoints
- `server/build_server.py` - Python build server (runs pygbag)
- `frontend/app/publish/page.tsx` - Project publishing UI
- `frontend/app/projects/page.tsx` - Projects list with iframe player

## License

MIT