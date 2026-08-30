import pool from "../config/database.js";
import { emailQueue } from "../queues/email.queue.js";

interface ScheduleEmailInput {
  senderId: string; // users.id from JWT
  fromEmail?: string;

  // New Compose supports multiple recipients
  recipients: string[];

  subject: string;
  body: string;
  scheduledAt: Date;

  // Compose settings
  delayBetweenEmails?: number;
  hourlyLimit?: number;

  // Attachment metadata for now
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

  // --------------------------------------------------
  // 2. Get logged-in user's details
  // --------------------------------------------------

  const userResult = await pool.query(
    `
    SELECT
      id,
      email,
      name
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
  // 3. Resolve sender
  // --------------------------------------------------

  const requestedSenderEmail =
    fromEmail?.trim().toLowerCase();

  let senderResult;

  if (requestedSenderEmail) {
    // Never allow a user to send from a sender that does not
    // belong to their account.
    senderResult = await pool.query(
      `
      SELECT
        id,
        user_id,
        email,
        display_name
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
    // Existing accounts are guaranteed to have a sender by auth flows.
    senderResult = await pool.query(
      `
      SELECT
        id,
        user_id,
        email,
        display_name
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
    // 5. Add email to BullMQ
    // --------------------------------------------------

    const delay = Math.max(
      0,
      scheduledAt.getTime() - Date.now()
    );

    const job = await emailQueue.add(
      "send-email",
      {
        emailId: email.id,

        // Keep Compose settings available to worker
        delayBetweenEmails,
        hourlyLimit,

        // Metadata only for now
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
      SET
        bullmq_job_id = $1,
        updated_at = NOW()
      WHERE id = $2
      `,
      [job.id, email.id]
    );

    email.bullmq_job_id = job.id;

    createdEmails.push(email);

    console.log(
      `Email ${email.id} scheduled successfully.`
    );

    console.log(
      `Recipient: ${recipientEmail}`
    );

    console.log(
      `Sender: ${sender.email}`
    );

    console.log(
      `BullMQ job created: ${job.id}`
    );
  }

  // --------------------------------------------------
  // 7. Return campaign result
  // --------------------------------------------------

  return {
    sender: {
      id: sender.id,
      email: sender.email,
      displayName: sender.display_name,
    },

    recipients: cleanedRecipients,

    emails: createdEmails,

    totalRecipients: createdEmails.length,

    scheduledAt,

    delayBetweenEmails,

    hourlyLimit,

    attachmentsCount: attachments.length,
  };
}