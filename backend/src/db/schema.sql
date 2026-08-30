-- ============================================================
-- ReachInbox Database Schema
-- PostgreSQL
-- ============================================================

-- Required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Google OAuth
    google_id VARCHAR(255) UNIQUE,

    -- Basic profile
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    avatar_url TEXT,

    -- Email/password authentication
    password_hash TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- SLACK CONNECTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS slack_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    -- Slack workspace information
    slack_team_id VARCHAR(255) NOT NULL,
    slack_team_name VARCHAR(255),

    -- Slack bot/user information
    slack_bot_user_id VARCHAR(255),

    -- Channel used for rate-limit notifications
    slack_channel_id VARCHAR(255),

    -- OAuth access token
    access_token TEXT NOT NULL,

    connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- One Slack connection per user
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_slack_connections_user
ON slack_connections(user_id);

CREATE INDEX IF NOT EXISTS idx_slack_connections_team
ON slack_connections(slack_team_id);


-- ============================================================
-- SENDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS senders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    email VARCHAR(320) NOT NULL,
    display_name VARCHAR(255),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, email)
);


-- ============================================================
-- EMAILS
-- ============================================================

CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    sender_id UUID NOT NULL
        REFERENCES senders(id)
        ON DELETE CASCADE,

    recipient_email VARCHAR(320) NOT NULL,

    subject TEXT NOT NULL,
    body TEXT NOT NULL,

    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,

    status VARCHAR(20) NOT NULL DEFAULT 'scheduled',

    -- BullMQ job ID
    bullmq_job_id VARCHAR(255) UNIQUE,

    -- Number of send attempts
    attempts INTEGER NOT NULL DEFAULT 0,

    -- Error message if sending fails
    error_message TEXT,

    -- Attachment metadata
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Ethereal preview URL
    ethereal_preview_url TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT emails_status_check
        CHECK (
            status IN (
                'scheduled',
                'processing',
                'sent',
                'failed'
            )
        )
);


-- ============================================================
-- EMAIL INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_emails_status
ON emails(status);

CREATE INDEX IF NOT EXISTS idx_emails_scheduled_at
ON emails(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_emails_recipient
ON emails(recipient_email);

CREATE INDEX IF NOT EXISTS idx_emails_sender
ON emails(sender_id);

CREATE INDEX IF NOT EXISTS idx_emails_bullmq_job_id
ON emails(bullmq_job_id);

CREATE INDEX IF NOT EXISTS idx_emails_created_at
ON emails(created_at);

CREATE INDEX IF NOT EXISTS idx_emails_sent_at
ON emails(sent_at);

CREATE INDEX IF NOT EXISTS idx_emails_sender_status
ON emails(sender_id, status);


-- ============================================================
-- AUTO UPDATE updated_at FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

-- Users
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- Emails
DROP TRIGGER IF EXISTS trg_emails_updated_at ON emails;

CREATE TRIGGER trg_emails_updated_at
BEFORE UPDATE ON emails
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- Slack connections
DROP TRIGGER IF EXISTS trg_slack_connections_updated_at
ON slack_connections;

CREATE TRIGGER trg_slack_connections_updated_at
BEFORE UPDATE ON slack_connections
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- END OF SCHEMA
-- ============================================================