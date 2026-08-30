# ReachInbox Full-stack Email Scheduler

A production-oriented full-stack email scheduling system built for the ReachInbox hiring assignment. The application supports persistent email scheduling, BullMQ-based delayed jobs, PostgreSQL persistence, Redis-backed rate limiting, Elasticsearch search, Ethereal SMTP, Google OAuth, Slack notifications, and a Bull Board queue dashboard.

## Tech Stack

### Backend

* TypeScript
* Express.js
* PostgreSQL
* BullMQ
* Redis
* Elasticsearch
* Ethereal Email / SMTP
* Bull Board
* Google OAuth 2.0
* Slack OAuth v2

### Frontend

* React
* TypeScript
* Vite
* CSS

## Project Structure

```text
reachinbox-email-scheduler/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── db/
│   │   ├── middleware/
│   │   ├── queues/
│   │   ├── routes/
│   │   ├── services/
│   │   └── server.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── types/
│   └── package.json
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

# Getting Started

## 1. Start Infrastructure

From the project root:

```bash
docker compose up -d
```

This starts the required infrastructure services:

* PostgreSQL
* Redis
* Elasticsearch

Check the containers:

```bash
docker ps
```

---

# Backend Setup

Open a terminal in the project root:

```bash
cd backend
npm install
```

Create the environment file:

```bash
copy ..\.env.example .env
```

For Git Bash/Linux/macOS:

```bash
cp ../.env.example .env
```

Update `backend/.env` with the required values.

Build the backend:

```bash
npm run build
```

Start the API server:

```bash
npm run dev
```

The backend runs on the configured port, normally:

```text
http://localhost:5000
```

## Start BullMQ Worker

Open a second terminal:

```bash
cd backend
npm run worker
```

The API server and BullMQ worker should run simultaneously.

---

# Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend normally runs at:

```text
http://localhost:5173
```

---

# Environment Variables

The root `.env.example` contains the environment variables required by the application.

The main configuration categories are:

### Database

```env
DATABASE_URL=...
```

### Redis

```env
REDIS_URL=...
```

### Elasticsearch

```env
ELASTICSEARCH_URL=...
```

### JWT

```env
JWT_SECRET=...
```

### Google OAuth

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=...
```

Configure the Google OAuth callback URL to match:

```text
http://localhost:5000/api/auth/google/callback
```

### Ethereal Email

Create an account at Ethereal Email and configure the SMTP credentials in `backend/.env`.

Example:

```env
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your_ethereal_username
SMTP_PASS=your_ethereal_password
```

Ethereal provides a fake SMTP environment for testing without sending real emails to recipients.

### Slack

Configure the Slack OAuth application and add the callback URL configured by:

```env
SLACK_REDIRECT_URI=http://localhost:5000/api/slack/callback
```

Required Slack scopes include:

```text
chat:write
channels:read
groups:read
```

The Slack connection is stored per authenticated user in PostgreSQL.

### Scheduler Configuration

The scheduler configuration is controlled through environment variables, including:

```env
WORKER_CONCURRENCY=...
MAX_EMAILS_PER_HOUR_PER_SENDER=...
MIN_EMAIL_DELAY_MS=...
```

The exact values can be adjusted according to the desired test scenario.

---

# Architecture

## Email Scheduling

The scheduling flow is:

```text
Frontend
   ↓
Express API
   ↓
PostgreSQL
   ↓
BullMQ delayed job
   ↓
Redis
   ↓
BullMQ Worker
   ↓
Rate Limiter
   ↓
Ethereal SMTP
   ↓
PostgreSQL + Elasticsearch
```

When an email is scheduled:

1. The API validates the request.
2. The email is stored in PostgreSQL.
3. A BullMQ delayed job is created.
4. Redis persists the queue state.
5. When the scheduled time is reached, the worker processes the job.
6. The worker atomically claims the email before sending.
7. The rate limiter determines whether the sender can send.
8. If allowed, the email is sent through Ethereal SMTP.
9. The email status is updated in PostgreSQL.
10. The sent email is indexed into Elasticsearch.

No cron jobs are used.

---

# Persistence and Restart Recovery

The application uses PostgreSQL and Redis as persistent infrastructure.

Future scheduled emails are represented by:

* PostgreSQL records
* BullMQ delayed jobs stored in Redis

Because scheduling is handled by BullMQ rather than an in-memory timer or cron process, restarting the backend does not require rebuilding the schedule from scratch.

The worker resumes processing persistent BullMQ jobs after restart.

Before sending an email, the worker atomically transitions the email from:

```text
scheduled → processing
```

This prevents multiple workers from sending the same email concurrently.

After successful delivery:

```text
processing → sent
```

If delivery fails:

```text
processing → failed
```

This provides idempotency protection and prevents duplicate sends during normal concurrent processing.

---

# Worker Concurrency

BullMQ worker concurrency is configurable through:

```env
WORKER_CONCURRENCY
```

Multiple email jobs can therefore be processed in parallel while the database state transition and Redis-backed rate limiting protect against duplicate or excessive sends.

The design can handle large batches of scheduled emails without creating one long-running process per email.

---

# Minimum Delay Between Emails

A configurable minimum delay is enforced between email sends.

Configuration:

```env
MIN_EMAIL_DELAY_MS
```

This is implemented using the Redis-backed rate-limit/send-slot mechanism so that the delay is not dependent only on a single worker's in-memory state.

This helps simulate provider throttling behavior.

---

# Hourly Rate Limiting

The application supports a configurable per-sender hourly limit.

Configuration:

```env
MAX_EMAILS_PER_HOUR_PER_SENDER
```

Rate-limit state is stored in Redis using sender and hourly-window keys.

This makes the rate limit safe when multiple worker processes or instances are running.

Example:

```text
Sender A
   ↓
Hourly limit = N
   ↓
Redis counter
   ↓
Allow / Reschedule
```

When the hourly limit is reached:

1. The email is not permanently failed.
2. The email remains scheduled.
3. The worker calculates the next available hour.
4. A new BullMQ delayed job is created.
5. Processing continues when the next hour begins.

This preserves scheduled emails rather than dropping them.

---

# Slack Rate-limit Notifications

Slack integration uses a real Slack OAuth v2 flow.

The flow is:

```text
Dashboard
   ↓
Connect Slack
   ↓
Slack OAuth
   ↓
OAuth Callback
   ↓
Store Slack connection in PostgreSQL
   ↓
Rate Limit Hit
   ↓
Redis notification guard
   ↓
Slack chat.postMessage
```

When a sender reaches the hourly limit, the system sends a real Slack notification containing information about the rate-limit event.

Notifications are guarded by Redis so that the same sender is not repeatedly notified during the same hourly window.

If Slack is not connected, rate-limit processing continues normally without crashing the worker.

---

# Elasticsearch Search

Sent emails are indexed into Elasticsearch.

The search endpoint is:

```text
GET /api/emails/search
```

This allows sent/scheduled email data to be searched efficiently rather than relying only on database filtering.

The application includes Elasticsearch configuration and indexing logic in:

```text
backend/src/config/elasticsearch.ts
backend/src/services/email.search.ts
```

---

# Bull Board

Bull Board provides live queue visibility.

Queue dashboard:

```text
http://localhost:5000/admin/queues
```

It can be used to inspect:

* Waiting jobs
* Delayed jobs
* Active jobs
* Completed jobs
* Failed jobs

This is useful for monitoring scheduled email processing.

---

# Frontend Features

## Google Login

The application implements real Google OAuth authentication.

After successful authentication:

* The user is redirected to the dashboard.
* User name is displayed.
* User email is displayed.
* User avatar is displayed.
* Logout is available.

---

## Dashboard

The dashboard provides access to:

* Scheduled emails
* Sent emails
* Failed emails
* All emails
* Email details
* Compose email
* Slack connection

---

## Compose Email

Users can:

* Enter email subject
* Enter email body
* Upload a CSV/text file containing email leads
* Detect email addresses from the uploaded file
* Configure start time
* Configure delay between emails
* Configure hourly sending limit
* Schedule the emails

---

## Scheduled Emails

The scheduled email view displays:

* Recipient
* Subject
* Scheduled time
* Status

Loading and empty states are handled in the UI.

---

## Sent Emails

The sent email view displays:

* Recipient
* Subject
* Sent time
* Status

Supported statuses include:

```text
sent
failed
```

---

# Behavior Under Load

The system is designed to handle large batches such as 1000+ emails scheduled around the same time.

BullMQ manages the jobs persistently in Redis while configurable worker concurrency controls parallel processing.

When the hourly sender limit is reached, additional jobs are not dropped. They are rescheduled for the next available hour.

The combination of:

* BullMQ delayed jobs
* Redis-backed rate limiting
* Worker concurrency
* PostgreSQL state transitions
* Idempotency checks

allows the system to process large scheduled batches without relying on cron jobs or in-memory scheduling.

---

# API / Queue Components

Important backend components include:

```text
backend/src/queues/email.queue.ts
backend/src/queues/email.worker.ts
backend/src/services/email.service.ts
backend/src/services/email.sender.ts
backend/src/services/rate.limiter.ts
backend/src/services/slack.service.ts
backend/src/services/email.search.ts
backend/src/routes/email.routes.ts
backend/src/routes/auth.routes.ts
backend/src/routes/queue.dashboard.ts
```

---

# Features Implemented

## Backend

* [x] Express.js API
* [x] TypeScript
* [x] PostgreSQL persistence
* [x] BullMQ
* [x] Redis
* [x] Delayed email scheduling
* [x] Persistent scheduled jobs
* [x] Worker concurrency
* [x] Minimum delay between sends
* [x] Per-sender hourly rate limiting
* [x] Rate-limit rescheduling
* [x] Idempotency protection
* [x] Ethereal SMTP
* [x] Elasticsearch indexing/search
* [x] Bull Board queue dashboard
* [x] Google OAuth
* [x] Slack OAuth
* [x] Live Slack rate-limit notification
* [x] Slack disconnect/reconnect handling

## Frontend

* [x] React + TypeScript
* [x] Google login
* [x] Dashboard
* [x] User profile information
* [x] Logout
* [x] Compose email
* [x] CSV/text lead upload
* [x] Email detection
* [x] Scheduling configuration
* [x] Scheduled emails view
* [x] Sent emails view
* [x] Failed emails view
* [x] Email details
* [x] Loading states
* [x] Empty states
* [x] Basic error handling

---

# Demo Video

The demonstration video covers the following:

1. Google login
2. Dashboard overview
3. Compose and schedule emails
4. CSV lead upload
5. Scheduled emails
6. Sent emails
7. Slack rate-limit notification
8. Bull Board queue monitoring
9. Backend restart scenario
10. Verification that future scheduled emails remain persistent after restart

The demo video is kept within the required 5-minute limit.

---

# Restart Test

To verify persistence:

1. Schedule an email for a future time.
2. Stop the backend server.
3. Keep PostgreSQL and Redis running.
4. Start the backend and worker again.
5. Verify that the future BullMQ job remains available.
6. Verify that the email is processed at the scheduled time.

No cron job or in-memory timer is required.

---

# Security

Environment files containing secrets are intentionally excluded from Git.

Never commit:

```text
.env
backend/.env
frontend/.env
```

Use:

```text
.env.example
```

for documenting required environment variables.

OAuth secrets, SMTP credentials, JWT secrets, and Slack tokens must only exist in local environment files.

---

# Assumptions, Shortcuts and Trade-offs

* Ethereal Email is used because the assignment requires a fake SMTP provider.
* Redis is used for distributed rate-limit state so that multiple workers can safely share sending limits.
* PostgreSQL remains the source of truth for email state.
* BullMQ/Redis is responsible for delayed job execution.
* The implementation prioritizes reliable scheduling and idempotency over provider-specific production delivery guarantees.
* Elasticsearch is used as a search/indexing layer rather than the primary source of truth.
* Slack notifications are optional and only occur when the authenticated user has connected Slack.
* The system is designed to demonstrate production-oriented scheduling patterns while keeping infrastructure suitable for local development.

---

# Running the Complete System

Use three terminals.

### Terminal 1 — Infrastructure

```bash
docker compose up -d
```

### Terminal 2 — Backend API

```bash
cd backend
npm install
npm run build
npm run dev
```

### Terminal 3 — BullMQ Worker

```bash
cd backend
npm run worker
```

### Terminal 4 — Frontend

```bash
cd frontend
npm install
npm run dev
```

Then open:

```text
http://localhost:5173
```

Bull Board:

```text
http://localhost:5000/admin/queues
```
