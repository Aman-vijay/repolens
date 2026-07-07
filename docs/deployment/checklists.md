# Deployment Checklists

## Vercel (Frontend)

### Pre-Deployment

- [ ] All environment variables defined in Vercel project settings
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` set
- [ ] `CLERK_SECRET_KEY` set (server-side only)
- [ ] `NEXT_PUBLIC_API_URL` points to production Render URL

### Environment Variables (Vercel)

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...` | Clerk publishable key |
| `CLERK_SECRET_KEY` | `sk_test_...` | Server-side only |
| `NEXT_PUBLIC_API_URL` | `https://repolens-api.onrender.com` | Production API |

### Deployment Steps

1. Connect GitHub repository to Vercel
2. Select `apps/web` as root directory
3. Configure build command: `pnpm build`
4. Configure output directory: `.next`
5. Add environment variables
6. Deploy

### Post-Deployment

- [ ] Verify `/` loads correctly
- [ ] Verify `/sign-in` redirects to Clerk
- [ ] Verify `/dashboard` requires authentication
- [ ] Check Vercel function logs for errors

---

## Render (Backend + Worker)

### Pre-Deployment

- [ ] Create Web Service for API
- [ ] Create Background Worker for ARQ
- [ ] Create Redis instance (or use Upstash)

### API Service Configuration

| Setting | Value |
|---------|-------|
| Root Directory | `apps/api` |
| Build Command | `uv sync --all-packages` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Plan | Starter or higher |

### Worker Service Configuration

| Setting | Value |
|---------|-------|
| Root Directory | `workers` |
| Build Command | `uv sync --all-packages` |
| Start Command | `arq workers.worker.WorkerSettings` |
| Plan | Starter or higher |

### Environment Variables (Render)

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql+asyncpg://...` | Neon connection string |
| `REDIS_URL` | `redis://...` | Upstash Redis URL |
| `CLERK_SECRET_KEY` | `sk_test_...` | Clerk backend API key |
| `CLERK_WEBHOOK_SECRET` | `whsec_...` | Clerk webhook secret |
| `OPENAI_API_KEY` | `sk-...` | OpenAI API key |
| `FRONTEND_URL` | `https://repolens-web.vercel.app` | Production frontend URL |
| `SUPERADMIN_CLERK_USER_ID` | `user_...` | Superuser Clerk ID |

### Post-Deployment

- [ ] Health check: `GET /health` returns `{"status": "ok"}`
- [ ] API responds to requests
- [ ] Worker processes jobs from queue
- [ ] Check Render logs for errors

---

## Neon (PostgreSQL + pgvector)

### Pre-Deployment

- [ ] Create Neon project
- [ ] Enable pgvector extension
- [ ] Create database role for application

### Database Setup

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Connection String

Format: `postgresql+asyncpg://user:password@host.neon.tech/dbname?ssl=require`

### Post-Setup

- [ ] Connection works from local machine
- [ ] Connection works from Render
- [ ] pgvector extension is available: `SELECT extname FROM pg_extension WHERE extname = 'vector';`
- [ ] Run initial migrations: `make db-migrate`

---

## Upstash (Redis)

### Pre-Deployment

- [ ] Create Upstash Redis database
- [ ] Note the connection URL and token

### Connection String

Format: `redis://default:password@host.upstash.io:6379`

### Post-Setup

- [ ] Connection works from local machine
- [ ] Connection works from Render
- [ ] ARQ worker connects successfully

---

## Production Smoke Tests

### Backend API

```bash
# Health check
curl https://repolens-api.onrender.com/health

# Create a project (requires auth)
curl -X POST https://repolens-api.onrender.com/api/projects \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Smoke Test"}'
```

### Frontend

1. Navigate to production URL
2. Sign in with Clerk
3. Create a project
4. Verify UI loads without errors
5. Check browser console for errors

### End-to-End Flow

1. Create project
2. Import repository
3. Wait for analysis to complete
4. Run a search query
5. Ask a chat question
6. Generate a plan

---

## Security Checklist

- [ ] CORS restricted to production frontend URL
- [ ] Clerk secret key not exposed in frontend
- [ ] Database credentials are secure
- [ ] Redis connection uses authentication
- [ ] No secrets in GitHub repository
- [ ] Webhook secrets are set and rotated
- [ ] Rate limiting is configured

---

## Monitoring Setup

- [ ] Set up error tracking (Sentry)
- [ ] Configure latency alerts (p95 > 2x baseline)
- [ ] Set up uptime monitoring
- [ ] Configure log aggregation

---

## Rollback Procedure

### Vercel

1. Go to Vercel dashboard
2. Select deployment
3. Click "..." menu → "Promote to Production"

### Render

1. Go to Render dashboard
2. Select service
3. Click "Instant Rollback"
4. Choose previous deployment

### Neon

- Point-in-time recovery if needed
- Backup restoration from Neon dashboard

---

## Critical Contacts

| Role | Contact | Notes |
|------|---------|-------|
| OpenAI API | OpenAI Support | API issues |
| Clerk | Clerk Support | Auth issues |
| Neon | Neon Support | Database issues |
| Upstash | Upstash Support | Redis issues |
