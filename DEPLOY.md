# Hermes Support Library — Railway Deployment Guide

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | https://nodejs.org |
| Railway CLI | latest | `npm install -g @railway/cli` |
| Git | any | https://git-scm.com |

---

## Step-by-step Railway Setup

### 1. Login to Railway

```bash
railway login
```

Follow the browser prompt to authenticate with your Railway account.

---

### 2. Initialise the project

```bash
cd hermes-support-web
railway init
```

- When prompted for a project name enter **`hermes-support`**.
- This creates a `railway.json` in the project root and links the directory to your new Railway project.

---

### 3. Add PostgreSQL

In the Railway dashboard:

1. Open the **hermes-support** project.
2. Click **+ New** → **Database** → **PostgreSQL**.
3. Railway provisions a Postgres instance and automatically exposes `DATABASE_URL` as a shared variable — it will be injected into your service at deploy time.

---

### 4. Set environment variables

In the Railway dashboard go to your **hermes-support-web** service → **Variables** tab and add each of the following. Do **not** commit real values to git; use `.env.example` as the reference.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Auto-set by Railway Postgres plugin — verify it exists |
| `APP_URL` | Your Railway public URL, e.g. `https://hermes-support-web.up.railway.app` |
| `NODE_ENV` | `production` |
| `NEXTAUTH_SECRET` | Random 32-char secret — generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Same as `APP_URL` |
| `ADMIN_SECRET` | Secret used by the one-time admin setup endpoint |
| `HERMES_API_SECRET` | Shared secret for signing requests from Hermes agents |
| `CRON_SECRET` | Random secret used to authenticate cron POST requests |
| `STORAGE_ENDPOINT` | Cloudflare R2 or S3 endpoint URL |
| `STORAGE_BUCKET` | Bucket name, e.g. `hermes-photos` |
| `STORAGE_ACCESS_KEY` | S3-compatible access key ID |
| `STORAGE_SECRET_KEY` | S3-compatible secret access key |
| `STORAGE_PUBLIC_URL` | Public base URL for stored objects |
| `INSTAGRAM_API_TOKEN` | *(optional)* Instagram Graph API token |
| `META_APP_ID` | *(optional)* Meta app ID |
| `META_APP_SECRET` | *(optional)* Meta app secret |

You can also bulk-import via the Railway CLI:

```bash
# Copy .env.example, fill in real values, then push
cp .env.example .env.production
railway variables set --from-file .env.production
```

---

### 5. Set up Cloudflare R2 (or AWS S3) for image storage

#### Cloudflare R2

1. Log in to the Cloudflare dashboard → **R2** → **Create bucket** → name it `hermes-photos`.
2. Under **Settings** → **Public access**, enable the public bucket URL and note the `pub-xxxxx.r2.dev` domain.
3. Under **Manage R2 API tokens**, create a token with **Object Read & Write** on the `hermes-photos` bucket.
4. Set the token's **Access Key ID** → `STORAGE_ACCESS_KEY` and **Secret Access Key** → `STORAGE_SECRET_KEY`.
5. Set `STORAGE_ENDPOINT` to `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

#### AWS S3 (alternative)

1. Create a bucket in your chosen region (e.g. `us-east-1`).
2. Create an IAM user with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on the bucket ARN.
3. Generate an access key pair and populate `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY`.
4. Set `STORAGE_ENDPOINT` to `https://s3.<region>.amazonaws.com`.

#### Bucket policy for public read access

Apply this bucket policy so uploaded photos are publicly readable:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::hermes-photos/*"
    }
  ]
}
```

For Cloudflare R2 enable the **Allow public access** toggle in the dashboard instead of using a JSON policy.

---

### 6. First deploy

```bash
railway up
```

Railway will detect the `railway.toml`, run Nixpacks to build the image, execute `npm run db:generate && npm run build`, and start the container with `npm run db:migrate && npm start`.

Watch logs in real time:

```bash
railway logs --tail
```

---

### 7. Run the database migration

If you need to run the migration manually after the initial deploy:

```bash
railway run npm run db:migrate
```

This executes `prisma migrate deploy` inside the Railway environment with the live `DATABASE_URL`.

---

### 8. Seed the database

```bash
railway run npm run db:seed
```

This populates any required baseline data (lookup tables, default config, etc.).

---

### 9. Set up cron jobs

Railway does not have a built-in cron scheduler. Use an external cron service (e.g. **cron-job.org**, **EasyCron**, or a Railway cron worker) to POST to each endpoint at the specified interval. All requests must include the `x-cron-secret` header matching `CRON_SECRET`.

| Job | Schedule | Command |
|-----|----------|---------|
| `fetch-metrics` | Every hour (`:00`) | `POST $APP_URL/api/cron/fetch-metrics` |
| `posting-monitor` | Every hour (`:30`) | `POST $APP_URL/api/cron/posting-monitor` |
| `cleanup-locks` | Every 30 minutes | `POST $APP_URL/api/cron/cleanup-locks` |

Example curl command for each (replace `$APP_URL` and `$CRON_SECRET` with real values):

```bash
# fetch-metrics
curl -s -X POST https://hermes-support-web.up.railway.app/api/cron/fetch-metrics \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json"

# posting-monitor
curl -s -X POST https://hermes-support-web.up.railway.app/api/cron/posting-monitor \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json"

# cleanup-locks
curl -s -X POST https://hermes-support-web.up.railway.app/api/cron/cleanup-locks \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json"
```

---

### 10. Verify health

```bash
curl https://hermes-support-web.up.railway.app/api/health
```

Expected response when everything is healthy:

```json
{
  "status": "ok",
  "db": "connected",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

A `503` with `"db": "disconnected"` means the database is unreachable — check `DATABASE_URL` and Railway Postgres status.

---

## Adding a Hermes Agent API Key

1. Open the app at `$APP_URL` and sign in as admin.
2. Navigate to **Dashboard** → **Hermes Agents**.
3. Click **Add Agent** and fill in the agent name and description.
4. The system generates an API key — copy it immediately (it is shown only once).
5. Provide the key to the Hermes agent operator. The agent must include it in every request as `Authorization: Bearer <key>`.

---

## Testing the Hermes API

All four Hermes API endpoints accept JSON and require a Bearer token.

### POST `/api/hermes/check-in` — agent heartbeat

```bash
curl -s -X POST https://hermes-support-web.up.railway.app/api/hermes/check-in \
  -H "Authorization: Bearer <AGENT_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"agentId": "agent-uuid-here", "status": "idle"}'
```

### GET `/api/hermes/next-task` — fetch the next assigned task

```bash
curl -s https://hermes-support-web.up.railway.app/api/hermes/next-task \
  -H "Authorization: Bearer <AGENT_API_KEY>"
```

### POST `/api/hermes/complete-task` — mark a task complete

```bash
curl -s -X POST https://hermes-support-web.up.railway.app/api/hermes/complete-task \
  -H "Authorization: Bearer <AGENT_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"taskId": "task-uuid-here", "result": {"success": true, "data": {}}}'
```

### POST `/api/hermes/report-error` — report a task failure

```bash
curl -s -X POST https://hermes-support-web.up.railway.app/api/hermes/report-error \
  -H "Authorization: Bearer <AGENT_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"taskId": "task-uuid-here", "error": "Describe what went wrong"}'
```

---

## Useful Railway CLI Commands

```bash
# Stream live logs
railway logs --tail

# Open the deployed app in the browser
railway open

# SSH-style exec into the Railway environment
railway run <command>

# Check current linked project/environment
railway status

# List all services in the project
railway service list
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Build fails at `db:generate` | `prisma` not in `dependencies` | Move `prisma` from `devDependencies` to `dependencies` in `package.json` |
| `P1001` database connection error on start | `DATABASE_URL` not set or wrong | Re-check Railway Postgres plugin is attached and variable is shared with the service |
| Health check returns 503 | DB unreachable | Check Railway Postgres service is running; verify SSL mode in connection string |
| Cron jobs return 401 | Wrong `CRON_SECRET` in caller | Ensure the cron job HTTP header exactly matches the `CRON_SECRET` Railway variable |
| Images not loading | Bucket not public or wrong `STORAGE_PUBLIC_URL` | Re-apply public bucket policy; confirm `STORAGE_PUBLIC_URL` has no trailing slash |
