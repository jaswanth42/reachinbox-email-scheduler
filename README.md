# ReachInbox Full-stack Email Scheduler

## Stack
- Backend: TypeScript, Express, PostgreSQL, BullMQ, Redis, Elasticsearch, Ethereal SMTP
- Frontend: React + TypeScript
- Queue dashboard: Bull Board

## Run

### 1. Infrastructure
```bash
docker compose up -d
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env
# fill Google, Slack and Ethereal values
npm run build
npm run dev
```
In a second terminal:
```bash
cd backend
npm run worker
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

## Scheduler architecture
1. The API stores every email in PostgreSQL before creating its BullMQ delayed job.
2. BullMQ/Redis owns delayed execution; there are no cron jobs.
3. Redis persistence (AOF) and PostgreSQL volumes survive container/server restarts.
4. The worker atomically claims an email (`scheduled -> processing`) before reserving a send slot, preventing duplicate jobs from sending the same email.
5. The Redis-backed send-slot limiter enforces a configurable minimum delay and hourly limit per sender.
6. When the hourly limit is reached, the email is returned to `scheduled` and a new delayed BullMQ job is created for the next hour.
7. Worker concurrency is controlled by `WORKER_CONCURRENCY`.

## Slack
Click **Connect Slack** in the dashboard profile menu. The backend starts a real Slack OAuth v2 flow, exchanges the authorization code, stores the user's Slack connection in PostgreSQL, and uses that stored token/channel for rate-limit notifications. If Slack is disconnected, rate-limit handling continues without crashing.

Required Slack app scopes: `chat:write`, `channels:read`, `groups:read`. Add the callback URL from `SLACK_REDIRECT_URI` to the Slack app.

## Search
Sent emails are indexed into Elasticsearch. The email search endpoint is available at `/api/emails/search`.

## Bull Board
Queue visibility is available at `/admin/queues`.

## Security
Never commit `.env`. Use `backend/.env.example` for submission.
