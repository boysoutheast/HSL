# Hermes Support Library — Claude Code Instructions

## Project Overview
This is a Next.js 14 web app deployed on Railway. It serves as a **library and control center** for Hermes AI agents that manage Instagram content for CPAS (Shopee affiliate) and organic campaigns.

## Stack
- Next.js 14 (App Router) + TypeScript
- Prisma ORM + PostgreSQL (Railway)
- Tailwind CSS
- **Railway Volume** (`/data/photos`) for photo storage — no external S3
- Railway Cron for posting monitor jobs

## Key Architecture Rules
1. **Zero-worker architecture** — semua operasi Meta Ads (campaign/adset/ad, catalog, audience, funnel) dieksekusi langsung in-cron/in-request via Graph API. Tidak ada internal worker task queue.
2. **Hermes agents access data ONLY via API** — never direct DB access
3. **Assignment-based filtering** — every Hermes API response is filtered by what's assigned to that specific agent's API key
4. **API key auth** — SHA-256 hashed, stored in `hermes_agents.api_key_hash`, validated via Bearer token
5. **Photos never stored in DB** — only URLs + metadata; actual files go to object storage
6. **Photo storage** — filesystem via `src/lib/storage.ts` → Railway Volume at `/data/photos`. Served via `/api/photos/serve/[...key]` with 1yr cache header. Path traversal protected.
7. **Cron endpoints** protected by `x-cron-secret` header matching `CRON_SECRET` env var
7. **Admin routes** (`/api/admin/*`) protected by session cookie middleware

## Directory Structure
```
hermes-support-web/
├── prisma/
│   ├── schema.prisma        # 14 models
│   └── seed.ts              # Default settings + admin user
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── hermes/      # 4 Hermes agent endpoints
│   │   │   ├── admin/       # CRUD + management endpoints
│   │   │   ├── cron/        # 3 cron job endpoints
│   │   │   └── photos/      # Image upload endpoint
│   │   ├── (dashboard pages)
│   │   └── globals.css
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   └── ui/              # Modal, StatusBadge, Table
│   ├── lib/
│   │   ├── prisma.ts        # Singleton PrismaClient
│   │   ├── auth.ts          # API key hash + validation
│   │   ├── storage.ts       # S3 upload helpers
│   │   └── posting-monitor.ts  # Monitor rules engine
│   └── middleware.ts        # Session guard for /api/admin/*
├── .env.example             # All required env vars
├── railway.toml             # Railway deploy config
├── Dockerfile               # Multi-stage Alpine build
└── DEPLOY.md                # Step-by-step deployment guide
```

## Posting Monitor Status Flow
```
WAITING → MONITORING (new post) → STILL_GROWING / HOT_VIDEO / NEED_NEW_VIDEO → READY_UPLOAD
```
Rules engine lives in `src/lib/posting-monitor.ts`.

## Hermes API Endpoints
- `GET /api/hermes/library` — full assigned library
- `GET /api/hermes/ready-upload` — next account ready to post
- `POST /api/hermes/content-log` — submit generate/post result
- `POST /api/hermes/cep-feedback` — submit new CEP for review
- `GET /api/hermes/generated-media` — list completed generated media (worker fetch for CPAS integration)

## Admin Login
- Default: `admin@hermes.local` / `hermes123`
- Change after first deploy via Settings

## Common Commands
```bash
npm run dev          # Local dev
npm run build        # Production build
npm run db:generate  # Regenerate Prisma client after schema change
npm run db:migrate   # Run pending migrations
npm run db:seed      # Seed default data
```
