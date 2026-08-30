# ReachInbox Full-Stack Email Scheduler

A production-oriented full-stack email scheduling system built for the ReachInbox hiring assignment.

The application allows users to authenticate, upload email leads, schedule emails for future delivery, process them reliably using BullMQ and Redis, send them through Ethereal SMTP, search sent emails through Elasticsearch, and receive Slack notifications when an hourly sending limit is reached.

---

## 🚀 Tech Stack

### Backend

* TypeScript
* Express.js
* PostgreSQL
* BullMQ
* Redis
* Elasticsearch
* Nodemailer
* Ethereal Email
* JWT
* Google OAuth 2.0
* Slack OAuth 2.0
* Bull Board

### Frontend

* React
* TypeScript
* Vite
* CSS
* Responsive dashboard UI

### Infrastructure

* Docker
* Docker Compose

---

# 📁 Project Structure

```text
reachinbox-email-scheduler/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts
│   │   │   ├── elasticsearch.ts
│   │   │   └── redis.ts
│   │   │
│   │   ├── db/
│   │   │   └── schema.sql
│   │   │
│   │   ├── middleware/
│   │   │   └── auth.middleware.ts
│   │   │
│   │   ├── queues/
│   │   │   ├── email.queue.ts
│   │   │   ├── email.worker.ts
│   │   │   └── test.queue.ts
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── email.routes.ts
│   │   │   └── queue.dashboard.ts
│   │   │
│   │   ├── services/
│   │   │   ├── email.search.ts
│   │   │   ├── email.sender.ts
│   │   │   ├── email.service.ts
│   │   │   ├── rate.limiter.ts
│   │   │   ├── slack.service.ts
│   │   │   └── test.email.ts
│   │   │
│   │   └── server.ts
│   │
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── types/
│   │   ├── App.tsx
│   │   └── main.tsx
│   │
│   ├── package.json
│   └── vite.config.ts
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

# ⚙️ Prerequisites

Make sure the following are installed:

* Node.js 18+
* npm
* Docker Desktop
* Git

---

# 🐳 1. Start Infrastructure

From the project root:

```bash
docker compose up -d
```

This starts:

* PostgreSQL
* Redis
* Elasticsearch

Check the containers:

```bash
docker ps
```

Expected services:

```text
reachinbox-postgres
reachinbox-redis
reachinbox-elasticsearch
```

---

# 🗄️ 2. PostgreSQL

The application uses PostgreSQL for persistent application state.

Default configuration:

```text
Database: reachinbox
User: reachinbox
Password: reachinbox_password
Port: 5432
```

The schema is located at:

```text
backend/src/db/schema.sql
```

The PostgreSQL data is stored using a Docker volume, allowing database state to survive container restarts.

To connect manually:

```bash
docker exec -it reachinbox-postgres psql -U reachinbox -d reachinbox
```

---

# 🔴 3. Redis

Redis is used by BullMQ as the persistent job queue and also backs the rate-limiting logic.

Default configuration:

```text
Host: localhost
Port: 6379
```

Redis persistence is enabled through the Docker configuration.

BullMQ stores delayed jobs in Redis, meaning scheduled jobs are not dependent on the Node.js process remaining alive.

---

# 🔎 4. Elasticsearch

Elasticsearch is used to index sent emails and provide searchable email data.

Default configuration:

```text
ELASTICSEARCH_URL=http://localhost:9200
```

Sent emails are indexed after successful processing.

The backend exposes an email search endpoint:

```text
GET /api/emails/search
```

---

# 🔐 5. Environment Variables

Create:

```text
backend/.env
```

Do **not** commit this file.

Use the provided environment template:

```text
.env.example
```

From PowerShell while inside `backend`:

```powershell
Copy-Item ..\.env.example .env
```

Then configure the required values.

Example:

```env
PORT=5000

DATABASE_URL=postgresql://reachinbox:reachinbox_password@localhost:5432/reachinbox

REDIS_HOST=localhost
REDIS_PORT=6379

ELASTICSEARCH_URL=http://localhost:9200

WORKER_CONCURRENCY=5

SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=<ETHEREAL_USER>
SMTP_PASSWORD=<ETHEREAL_PASSWORD>
SMTP_FROM="ReachInbox <your-ethereal-email>"

MIN_EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=200

JWT_SECRET=<STRONG_RANDOM_SECRET>

GOOGLE_CLIENT_ID=<GOOGLE_CLIENT_ID>
GOOGLE_CLIENT_SECRET=<GOOGLE_CLIENT_SECRET>
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

FRONTEND_URL=http://localhost:5173

SLACK_CLIENT_ID=<SLACK_CLIENT_ID>
SLACK_CLIENT_SECRET=<SLACK_CLIENT_SECRET>
SLACK_REDIRECT_URI=http://localhost:5000/api/slack/callback
```

Never commit real passwords, API keys, OAuth secrets, JWT secrets, or Slack tokens.

---

# 📧 6. Ethereal Email Setup

Ethereal Email is used as the fake SMTP provider for testing email delivery.

Create an Ethereal test account and obtain:

* SMTP username
* SMTP password
* SMTP host
* SMTP port

Configure them in:

```text
backend/.env
```

Example:

```env
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=<ETHEREAL_USER>
SMTP_PASSWORD=<ETHEREAL_PASSWORD>
SMTP_FROM="ReachInbox <ETHEREAL_EMAIL>"
```

Ethereal provides a web interface where sent test emails can be inspected.

No real emails are sent to external recipients.

---

# 🔑 7. Google OAuth Setup

Google login is implemented using Passport and Google OAuth 2.0.

Create OAuth credentials in Google Cloud Console.

Configure:

```env
GOOGLE_CLIENT_ID=<YOUR_CLIENT_ID>
GOOGLE_CLIENT_SECRET=<YOUR_CLIENT_SECRET>
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
```

The following callback URL must be registered in the Google OAuth application:

```text
http://localhost:5000/api/auth/google/callback
```

After successful authentication, the backend generates a JWT and redirects the user to the frontend dashboard.

---

# 💬 8. Slack OAuth Setup

Slack integration uses a real Slack OAuth v2 authorization flow.

The user can select:

```text
Connect Slack
```

from the dashboard.

The flow is:

```text
Frontend
   ↓
Backend
   ↓
Slack OAuth Authorization
   ↓
Slack Callback
   ↓
Token Exchange
   ↓
PostgreSQL
```

The Slack connection is stored per authenticated user.

Configure:

```env
SLACK_CLIENT_ID=<SLACK_CLIENT_ID>
SLACK_CLIENT_SECRET=<SLACK_CLIENT_SECRET>
SLACK_REDIRECT_URI=http://localhost:5000/api/slack/callback
```

The Slack application's redirect URL must contain:

```text
http://localhost:5000/api/slack/callback
```

Required scopes include:

```text
chat:write
channels:read
channels:join
```

If the Slack connection is removed, rate-limit processing continues normally without crashing.

When the hourly rate limit is reached and Slack is connected, the backend sends a real Slack notification.

---

# 🖥️ 9. Run Backend

From the project root:

```bash
cd backend
npm install
```

Build the backend:

```bash
npm run build
```

Start the API:

```bash
npm run dev
```

The backend runs on:

```text
http://localhost:5000
```

---

# 👷 10. Start BullMQ Worker

The worker must run separately from the API server.

Open another terminal:

```bash
cd backend
npm run worker
```

The worker consumes scheduled jobs from BullMQ and processes emails.

---

# 🎨 11. Run Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on:

```text
http://localhost:5173
```

Open the displayed Vite URL in the browser.

---

# 🧠 Scheduler Architecture

The scheduler uses PostgreSQL + BullMQ + Redis.

The basic flow is:

```text
User
 │
 ▼
React Dashboard
 │
 ▼
Schedule Email API
 │
 ├──────────────► PostgreSQL
 │                 │
 │                 └── Email state
 │
 ▼
BullMQ
 │
 ▼
Redis
 │
 │ delayed until scheduled time
 ▼
Email Worker
 │
 ├── Idempotency check
 │
 ├── Rate-limit check
 │
 ├── Minimum delay check
 │
 └── SMTP send
 │
 ▼
Ethereal SMTP
 │
 ▼
PostgreSQL status update
 │
 ▼
Elasticsearch indexing
```

---

# ⏰ Scheduling

The application does **not** use cron jobs.

There is no:

```text
node-cron
cron
crontab
agenda
```

Instead, scheduled emails are represented as BullMQ delayed jobs.

When an email is scheduled:

1. The email is stored in PostgreSQL.
2. A BullMQ delayed job is created.
3. Redis persists the delayed job.
4. BullMQ waits until the scheduled execution time.
5. The worker picks up the job.
6. The worker processes the email.
7. PostgreSQL is updated with the final state.

This allows scheduling to work without continuously polling the database.

---

# 🔄 Persistence After Restart

The scheduler is designed to survive application restarts.

Scheduled jobs are stored in Redis through BullMQ.

Application email state is stored in PostgreSQL.

Therefore:

```text
Schedule email
      ↓
PostgreSQL
      +
BullMQ / Redis
      ↓
Server stops
      ↓
Server starts again
      ↓
Worker reconnects
      ↓
Pending BullMQ jobs continue
```

Future scheduled emails do not need to be recreated manually.

PostgreSQL and Redis Docker volumes provide persistent storage across container restarts.

---

# 🛡️ Idempotency / Duplicate Prevention

The worker does not blindly send every job it receives.

Before sending an email, the application checks and atomically transitions the email state.

Typical lifecycle:

```text
scheduled
    ↓
processing
    ↓
sent
```

If an email has already been processed, the worker does not send it again.

This protects against duplicate sends when multiple workers are processing jobs or when a job is retried.

---

# 🚦 Rate Limiting

The current configuration uses:

```env
MAX_EMAILS_PER_HOUR=200
```

This means a sender can send up to 200 emails within the configured hourly window.

The rate-limiting logic uses Redis-backed state rather than relying only on an in-memory counter.

This is important because multiple worker processes can share the same Redis-backed rate limit.

---

# ⏱️ Minimum Delay Between Emails

The configured minimum delay is:

```env
MIN_EMAIL_DELAY_MS=2000
```

Therefore:

```text
2 seconds minimum delay
```

is maintained between email sends.

This simulates provider throttling and prevents the worker from sending all emails simultaneously.

The value can be changed through the environment configuration.

For example:

```env
MIN_EMAIL_DELAY_MS=5000
```

would enforce a 5-second minimum delay.

---

# 📊 Worker Concurrency

Worker concurrency is configurable through:

```env
WORKER_CONCURRENCY=5
```

The worker can process up to five jobs concurrently.

The concurrency value is configurable rather than hardcoded.

Example:

```env
WORKER_CONCURRENCY=10
```

would allow up to ten concurrent jobs.

Database state transitions and Redis-backed rate limiting ensure that concurrent processing does not result in duplicate sends.

---

# 🧮 Behavior Under Heavy Load

The system is designed to handle situations where 1000+ emails are scheduled around the same time.

Example:

```text
1000 scheduled emails
        ↓
BullMQ / Redis
        ↓
5 concurrent workers
        ↓
Rate limiter
        ↓
Maximum 200/hour
        ↓
Remaining jobs rescheduled
```

The application does not attempt to send all 1000 emails immediately.

Instead:

* BullMQ manages the workload.
* Worker concurrency controls parallel processing.
* Minimum send delay prevents rapid bursts.
* Redis-backed hourly limits control throughput.
* Jobs that exceed the hourly limit are rescheduled.
* Emails are not permanently dropped because the rate limit was reached.

---

# 🔔 Slack Rate-Limit Notification

When the configured hourly limit is reached:

```text
Rate limit reached
       ↓
Redis rate limiter
       ↓
Slack connection lookup
       ↓
Slack API
       ↓
Notification sent
```

The Slack notification is an actual API request rather than only a console log.

If Slack is not connected:

```text
Rate limit reached
       ↓
No Slack connection
       ↓
Continue normally
```

The email job remains scheduled/rescheduled and the application does not crash.

---

# 🔍 Elasticsearch Search

Sent emails are indexed in Elasticsearch.

This provides searchable email data independently of the primary PostgreSQL state.

The application exposes:

```text
GET /api/emails/search
```

This can be used to search indexed email records.

The architecture is:

```text
Email successfully sent
        ↓
PostgreSQL status = sent
        ↓
Elasticsearch indexing
        ↓
Search API
```

---

# 📋 Bull Board

Bull Board is included for live queue visibility.

Queue dashboard:

```text
http://localhost:5000/admin/queues
```

It allows developers/reviewers to inspect BullMQ queues and monitor job states.

Useful states include:

* Waiting
* Delayed
* Active
* Completed
* Failed

This makes the scheduling behavior easier to demonstrate.

---

# 🖥️ Frontend Features

## Google Login

The frontend supports real Google OAuth.

After successful authentication:

```text
Google
  ↓
Backend OAuth callback
  ↓
JWT
  ↓
Frontend
  ↓
Dashboard
```

The header displays authenticated user information.

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

## Compose New Email

Users can compose an email with:

* Subject
* Body
* CSV/text lead upload
* Start time
* Delay between emails
* Hourly limit

The uploaded file is parsed to detect email addresses.

The UI displays the number of detected addresses before scheduling.

---

# 📅 Scheduled Emails

The scheduled email page displays:

* Recipient
* Subject
* Scheduled time
* Status

The UI includes:

* Loading states
* Empty states
* Status indicators
* Email information

---

# 📤 Sent Emails

The sent email page displays:

* Recipient
* Subject
* Sent time
* Status

Possible statuses include:

```text
sent
failed
```

---

# ❌ Failed Emails

Failed emails can be viewed separately so that unsuccessful deliveries can be inspected.

---

# 📄 Email Details

The application provides an email details page for viewing individual email information.

---

# 💬 Slack Connection

Users can connect their Slack workspace from the dashboard.

The connection is associated with the authenticated user and persisted in PostgreSQL.

The dashboard can also show whether Slack is connected.

Users can disconnect Slack and reconnect later without requiring a server redeployment.

---

# 🔐 Security

Sensitive configuration is stored in environment variables.

The repository intentionally excludes:

```text
.env
```

Build directories:

```text
dist/
```

and dependency directories:

```text
node_modules/
```

are also excluded from Git.

The root `.gitignore` prevents accidental commits of backend credentials.

Never commit:

* SMTP passwords
* Google OAuth secrets
* Slack secrets
* Slack bot tokens
* JWT secrets
* Database passwords

---

# 🧪 Useful Development Commands

### Build backend

```bash
cd backend
npm run build
```

### Start backend

```bash
npm run dev
```

### Start worker

```bash
npm run worker
```

### Start frontend

```bash
cd frontend
npm run dev
```

### Start infrastructure

```bash
docker compose up -d
```

### Stop infrastructure

```bash
docker compose down
```

### View Docker containers

```bash
docker ps
```

### View PostgreSQL data

```bash
docker exec -it reachinbox-postgres psql -U reachinbox -d reachinbox
```

---

# 🧪 Manual PostgreSQL Verification

To check Slack connections:

```bash
docker exec -it reachinbox-postgres psql -U reachinbox -d reachinbox -c "SELECT user_id, slack_team_id, slack_team_name, slack_channel_id, connected_at FROM slack_connections;"
```

To verify emails:

```bash
docker exec -it reachinbox-postgres psql -U reachinbox -d reachinbox -c "SELECT id, recipient, subject, status, scheduled_at, sent_at FROM emails ORDER BY created_at DESC;"
```

---

# 📌 Implemented Requirements

## Backend

| Requirement                   | Status |
| ----------------------------- | ------ |
| TypeScript                    | ✅      |
| Express.js                    | ✅      |
| PostgreSQL                    | ✅      |
| Redis                         | ✅      |
| BullMQ                        | ✅      |
| Delayed jobs                  | ✅      |
| No cron jobs                  | ✅      |
| Persistent scheduling         | ✅      |
| Restart recovery              | ✅      |
| Idempotency                   | ✅      |
| Worker concurrency            | ✅      |
| Configurable concurrency      | ✅      |
| Minimum email delay           | ✅      |
| Hourly rate limiting          | ✅      |
| Redis-backed rate limiting    | ✅      |
| Rate-limit rescheduling       | ✅      |
| Slack rate-limit notification | ✅      |
| Slack OAuth                   | ✅      |
| Slack disconnect/reconnect    | ✅      |
| Ethereal SMTP                 | ✅      |
| Elasticsearch indexing        | ✅      |
| Elasticsearch search          | ✅      |
| Bull Board                    | ✅      |

## Frontend

| Requirement         | Status |
| ------------------- | ------ |
| React               | ✅      |
| TypeScript          | ✅      |
| Google OAuth        | ✅      |
| Login               | ✅      |
| Logout              | ✅      |
| User information    | ✅      |
| Dashboard           | ✅      |
| Compose email       | ✅      |
| CSV lead upload     | ✅      |
| Email detection     | ✅      |
| Scheduled emails    | ✅      |
| Sent emails         | ✅      |
| Failed emails       | ✅      |
| Email details       | ✅      |
| Loading states      | ✅      |
| Empty states        | ✅      |
| Slack connection UI | ✅      |
| Error handling      | ✅      |

---

# 🏗️ Architecture Summary

The application separates responsibilities across multiple services:

```text
                    ┌──────────────────┐
                    │   React Client   │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Express API      │
                    │ TypeScript       │
                    └───────┬──────────┘
                            │
              ┌─────────────┼──────────────┐
              │             │              │
              ▼             ▼              ▼
        PostgreSQL       BullMQ         Elasticsearch
              │             │
              │             ▼
              │           Redis
              │             │
              │             ▼
              │       Email Worker
              │             │
              │             ▼
              │       Rate Limiter
              │             │
              │             ▼
              │       Ethereal SMTP
              │
              └─────────────┐
                            ▼
                       Slack API
```

---

# 🔄 End-to-End Email Flow

```text
1. User logs in
        ↓
2. User opens Compose
        ↓
3. Uploads CSV/text leads
        ↓
4. Application detects email addresses
        ↓
5. User configures:
      - Start time
      - Delay
      - Hourly limit
        ↓
6. API stores emails in PostgreSQL
        ↓
7. BullMQ delayed jobs are created
        ↓
8. Redis persists queue state
        ↓
9. Worker picks jobs at scheduled time
        ↓
10. Idempotency check
        ↓
11. Rate-limit check
        ↓
12. Minimum-delay check
        ↓
13. Email sent through Ethereal
        ↓
14. PostgreSQL updated
        ↓
15. Email indexed in Elasticsearch
        ↓
16. Dashboard displays final status
```

---

# 🔁 Restart Demonstration

The scheduler is designed so that future jobs survive a backend restart.

Demo flow:

```text
1. Schedule an email for a future time.

2. Confirm the job appears in Bull Board
   as a delayed job.

3. Stop the backend server.

4. Leave Redis and PostgreSQL running.

5. Start the backend and worker again.

6. BullMQ reconnects to Redis.

7. The delayed job remains available.

8. At the scheduled time, the worker processes it.

9. Email status changes to sent.
```

This demonstrates that scheduling does not depend on an in-memory timer.

---

# ⚖️ Assumptions, Shortcuts & Trade-offs

### Ethereal instead of real SMTP

Ethereal is intentionally used because the assignment requires a fake SMTP provider.

This allows email sending to be demonstrated safely without delivering real emails.

### PostgreSQL + Redis

PostgreSQL is the source of truth for application email state, while Redis/BullMQ manages asynchronous scheduling.

This separation allows the queue to scale independently from relational state.

### Configurable limits

Concurrency, minimum delay, and hourly limits are configured through environment variables instead of being hardcoded.

Current development configuration:

```text
Worker concurrency: 5
Minimum delay: 2 seconds
Hourly limit: 200 emails
```

### Rate-limit rescheduling

When the hourly limit is reached, jobs are not discarded.

They are rescheduled for a future available window.

This prioritizes reliability over immediate delivery.

### Local development

The project is configured for local development using Docker for infrastructure.

Production deployment would additionally require:

* TLS
* Secret management
* Production SMTP
* Managed PostgreSQL
* Managed Redis
* Elasticsearch authentication
* HTTPS OAuth callback URLs
* Monitoring and alerting

---

# 🎥 Demo Video

The recommended demo should be under 5 minutes.

Suggested flow:

### 1. Login

Show:

* Google login
* Dashboard
* User information

### 2. Compose

Show:

* Subject
* Body
* CSV upload
* Detected email count
* Start time
* Delay
* Hourly limit

### 3. Schedule

Click:

```text
Schedule
```

Show the scheduled emails in the dashboard.

### 4. Bull Board

Open:

```text
http://localhost:5000/admin/queues
```

Show the delayed BullMQ jobs.

### 5. Sent Emails

Wait for the scheduled time and show the email moving to:

```text
Sent
```

### 6. Restart Test

Schedule another future email.

Stop the backend.

Start it again.

Show that the future job remains scheduled and is eventually processed.

### 7. Slack

Connect Slack and trigger the hourly rate limit.

Show the actual Slack notification.

---

# 📦 Submission Checklist

Before submitting:

* [ ] Private GitHub repository created
* [ ] Backend committed
* [ ] Frontend committed
* [ ] Docker Compose committed
* [ ] README committed
* [ ] `.env` excluded from Git
* [ ] `node_modules` excluded
* [ ] Build output excluded
* [ ] Google OAuth configured
* [ ] Slack OAuth configured
* [ ] Ethereal configured
* [ ] PostgreSQL running
* [ ] Redis running
* [ ] Elasticsearch running
* [ ] BullMQ worker running
* [ ] Bull Board accessible
* [ ] Scheduled email tested
* [ ] Sent email tested
* [ ] Restart scenario tested
* [ ] Slack notification tested
* [ ] Demo video recorded
* [ ] Repository access granted to the required reviewer
* [ ] Submission form completed

---

# 👨‍💻 Repository

Repository:

```text
https://github.com/jaswanth42/reachinbox-email-scheduler
```

The repository contains the complete backend, frontend, infrastructure configuration, and documentation required for the ReachInbox assignment.

---

# 📄 License

This project was created as a technical assignment for ReachInbox / Outbox Labs.
