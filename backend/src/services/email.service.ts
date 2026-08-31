import pool from "../config/database.js";
import { emailQueue } from "../queues/email.queue.js";

interface ScheduleEmailInput {
  senderId: string;
  fromEmail?: string;
  recipients: string[];
  subject: string;
  body: string;
  scheduledAt: Date;
  delayBetweenEmails?: number;
  hourlyLimit?: number;
  attachments?: unknown[];
}

export async function scheduleEmail({
  senderId: userId,
  fromEmail,
  recipients,
  subject,
  body,
  scheduledAt,
  delayBetweenEmails = 0,
  hourlyLimit = 0,
  attachments = [],
}: ScheduleEmailInput) {
  // --------------------------------------------------
  // 1. Validate input
  // --------------------------------------------------

  if (!recipients || recipients.length === 0) {
    throw new Error("At least one recipient is required");
  }

  const cleanedRecipients = Array.from(
    new Set(
      recipients
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  if (cleanedRecipients.length === 0) {
    throw new Error("No valid recipients provided");
  }

  if (!subject.trim()) {
    throw new Error("Subject is required");
  }

  if (!body.trim()) {
    throw new Error("Message body is required");
  }

  if (!(scheduledAt instanceof Date) || Number.isNaN(scheduledAt.getTime())) {
    throw new Error("Invalid scheduledAt");
  }

  if (scheduledAt.getTime() <= Date.now()) {
    throw new Error("scheduledAt must be in the future");
  }

  const parsedDelay = Number(delayBetweenEmails) || 0;
  const parsedHourlyLimit = Number(hourlyLimit) || 0;

  if (parsedDelay < 0) {
    throw new Error("delayBetweenEmails cannot be negative");
  }

  if (parsedHourlyLimit < 0) {
    throw new Error("hourlyLimit cannot be negative");
  }

  // --------------------------------------------------
  // 2. Verify logged-in user
  // --------------------------------------------------

  const userResult = await pool.query(
    `
    SELECT id, email, name
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error("User not found");
  }

  const user = userResult.rows[0];

  // --------------------------------------------------
  // 3. Resolve sender belonging to this user
  // --------------------------------------------------

  const requestedSenderEmail = fromEmail?.trim().toLowerCase();

  let senderResult;

  if (requestedSenderEmail) {
    senderResult = await pool.query(
      `
      SELECT id, user_id, email, display_name
      FROM senders
      WHERE user_id = $1
        AND LOWER(email) = $2
      LIMIT 1
      `,
      [user.id, requestedSenderEmail]
    );

    if (senderResult.rows.length === 0) {
      throw new Error("Selected sender is not available for this account");
    }
  } else {
    senderResult = await pool.query(
      `
      SELECT id, user_id, email, display_name
      FROM senders
      WHERE user_id = $1
      ORDER BY created_at ASC
      LIMIT 1
      `,
      [user.id]
    );

    if (senderResult.rows.length === 0) {
      throw new Error("No sender is configured for this account");
    }
  }

  const sender = senderResult.rows[0];

  // --------------------------------------------------
  // 4. Create one email record per recipient
  // --------------------------------------------------

  const createdEmails = [];

  for (const recipientEmail of cleanedRecipients) {
    const result = await pool.query(
      `
      INSERT INTO emails (
        sender_id,
        recipient_email,
        subject,
        body,
        scheduled_at,
        status,
        attachments
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        'scheduled',
        $6
      )
      RETURNING *
      `,
      [
        sender.id,
        recipientEmail,
        subject.trim(),
        body.trim(),
        scheduledAt,
        JSON.stringify(attachments),
      ]
    );

    const email = result.rows[0];

    // --------------------------------------------------
    // 5. Create BullMQ delayed job
    // --------------------------------------------------

    const delay = Math.max(0, scheduledAt.getTime() - Date.now());

    const job = await emailQueue.add(
      "send-email",
      {
        emailId: email.id,
        delayBetweenEmails: parsedDelay,
        hourlyLimit: parsedHourlyLimit,
        attachments,
      },
      {
        delay,
        jobId: `email-${email.id}`,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: false,
        removeOnFail: false,
      }
    );

    // --------------------------------------------------
    // 6. Save BullMQ job ID
    // --------------------------------------------------

    await pool.query(
      `
      UPDATE emails
      SET bullmq_job_id = $1,
          updated_at = NOW()
      WHERE id = $2
      `,
      [job.id, email.id]
    );

    email.bullmq_job_id = job.id;
    createdEmails.push(email);

    console.log(
      `Email ${email.id} scheduled successfully for ${scheduledAt.toISOString()}`
    );
  }

  // --------------------------------------------------
  // 7. Return campaign data expected by email.routes.ts
  // --------------------------------------------------

  return {
    success: true,

    sender: {
      id: sender.id,
      email: sender.email,
      displayName: sender.display_name,
    },

    scheduledAt: scheduledAt.toISOString(),

    totalRecipients: createdEmails.length,

    recipients: createdEmails,

    delayBetweenEmails: parsedDelay,

    hourlyLimit: parsedHourlyLimit,

    attachmentsCount: attachments.length,

    emails: createdEmails,
  };
}