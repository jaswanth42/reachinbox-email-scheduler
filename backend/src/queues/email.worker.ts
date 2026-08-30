import { Worker } from "bullmq";
import redisConnection from "../config/redis.js";
import pool from "../config/database.js";
import { sendEmail } from "../services/email.sender.js";
import { acquireSendSlot } from "../services/rate.limiter.js";
import { emailQueue } from "./email.queue.js";
import { indexEmail } from "../services/email.search.js";
import { sendSlackRateLimitNotification } from "../services/slack.service.js";

const concurrency =
  Number(process.env.WORKER_CONCURRENCY) || 5;

const emailWorker = new Worker(
  "email-queue",

  async (job) => {
    console.log("Processing email job:", job.id);
    console.log("Job data:", job.data);

    const {
      emailId,
      delayBetweenEmails = 0,
      hourlyLimit = 0,
      attachments = [],
    } = job.data;

    if (!emailId) {
      throw new Error("emailId is missing from job data");
    }

    /*
     * 1. Get email from PostgreSQL
     */
    const emailResult = await pool.query(
      `
      SELECT
        e.id,
        e.recipient_email,
        e.subject,
        e.body,
        e.status,
        e.sender_id,
        s.user_id,
        e.scheduled_at,
        e.created_at,
        e.attachments,
        s.email AS sender_email
      FROM emails e
      JOIN senders s
        ON s.id = e.sender_id
      WHERE e.id = $1
      `,
      [emailId]
    );

    if (emailResult.rows.length === 0) {
      throw new Error(`Email ${emailId} not found`);
    }

    const email = emailResult.rows[0];

    /*
     * 2. Idempotency check
     */
    if (email.status === "sent") {
      console.log(
        `Email ${emailId} already sent. Skipping.`
      );

      return {
        skipped: true,
        reason: "already_sent",
      };
    }

    /*
     * 3. Atomically claim the email BEFORE reserving a send slot.
     * This prevents duplicate BullMQ deliveries from consuming rate-limit capacity.
     */
    const claimResult = await pool.query(
      `
      UPDATE emails
      SET
        status = 'processing',
        attempts = attempts + 1,
        updated_at = NOW()
      WHERE id = $1
        AND status = 'scheduled'
      RETURNING
        id,
        recipient_email,
        subject,
        body,
        sender_id
      `,
      [emailId]
    );

    if (claimResult.rows.length === 0) {
      const existingResult = await pool.query(
        `SELECT status FROM emails WHERE id = $1`,
        [emailId]
      );

      if (existingResult.rows.length === 0) {
        throw new Error(`Email ${emailId} not found`);
      }

      console.log(`Email ${emailId} is already being processed or sent. Skipping.`);
      return { skipped: true, reason: "already_processed" };
    }

    const claimedEmail = claimResult.rows[0];

    /*
     * 4. Acquire the Redis-backed hourly rate-limit slot.
     */
    try {
      await acquireSendSlot(
        email.sender_id,
        hourlyLimit,
        delayBetweenEmails
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown rate limiter error";

      if (errorMessage.startsWith("HOURLY_RATE_LIMIT:")) {
        console.log(`Hourly rate limit reached for email ${emailId}.`);

        const nextHour = new Date(Math.ceil(Date.now() / (60 * 60 * 1000)) * (60 * 60 * 1000));
        const delay = nextHour.getTime() - Date.now();

        await pool.query(
          `
          UPDATE emails
          SET status = 'scheduled', error_message = $1, scheduled_at = $2, updated_at = NOW()
          WHERE id = $3 AND status != 'sent'
          `,
          ["Hourly rate limit reached. Rescheduled.", nextHour, emailId]
        );

        try {
          await sendSlackRateLimitNotification(
            email.user_id,
            emailId,
            email.sender_id
          );
        } catch (slackError) {
          console.error(`Slack notification failed for email ${emailId}:`, slackError);
        }

        await emailQueue.add(
          "send-email",
          {
            emailId,
            delayBetweenEmails: delayBetweenEmails || 0,
            hourlyLimit: hourlyLimit || 0,
            attachments: attachments || email.attachments || [],
          },
          {
            delay,
            jobId: `email-${emailId}-hourly-${nextHour.getTime()}`,
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
            removeOnComplete: false,
            removeOnFail: false,
          }
        );

        return {
          rescheduled: true,
          reason: "hourly_rate_limit",
          emailId,
          nextRun: nextHour.toISOString(),
        };
      }

      // Restore state so BullMQ can retry a genuine limiter/Redis failure.
      await pool.query(
        `UPDATE emails SET status = 'scheduled', error_message = $1, updated_at = NOW() WHERE id = $2 AND status = 'processing'`,
        [errorMessage, emailId]
      );
      throw error;
    }

    /*
     * 5. Send. The Redis send slot already enforces the configured minimum delay.
     */
    /*
     * 6. Send email through SMTP
     */
    try {
      const emailAttachments =
        Array.isArray(email.attachments)
          ? email.attachments
          : [];

      const sendResult =
        await sendEmail(
          claimedEmail.recipient_email,
          claimedEmail.subject,
          claimedEmail.body,
          emailAttachments
        );

      const sentAt = new Date();

      /*
       * 7. Mark email as sent
       */
      await pool.query(
        `
        UPDATE emails
        SET
          status = 'sent',
          sent_at = $1,
          ethereal_preview_url = $2,
          error_message = NULL,
          updated_at = NOW()
        WHERE id = $3
          AND status = 'processing'
        `,
        [
          sentAt,
          sendResult.previewUrl,
          emailId,
        ]
      );

      /*
       * 8. Index successfully sent email
       */
      try {
        await indexEmail({
          id: claimedEmail.id,
          sender_id:
            claimedEmail.sender_id,
          sender_email:
            email.sender_email,
          recipient_email:
            claimedEmail.recipient_email,
          subject:
            claimedEmail.subject,
          body: claimedEmail.body,
          status: "sent",
          scheduled_at:
            email.scheduled_at,
          sent_at:
            sentAt.toISOString(),
          created_at:
            email.created_at,
        });
      } catch (error) {
        console.error(
          `Failed to index email ${emailId} in Elasticsearch:`,
          error
        );
      }

      console.log(
        `Email ${emailId} successfully sent`
      );

      return {
        success: true,
        emailId,
        recipient:
          claimedEmail.recipient_email,
        sender:
          email.sender_email,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown email sending error";

      /*
       * Genuine email sending failure.
       *
       * Put it back into scheduled state so
       * BullMQ can retry the job.
       */
      await pool.query(
        `
        UPDATE emails
        SET
          status = 'scheduled',
          error_message = $1,
          updated_at = NOW()
        WHERE id = $2
          AND status = 'processing'
        `,
        [
          errorMessage,
          emailId,
        ]
      );

      throw error;
    }
  },

  {
    connection: redisConnection,
    concurrency,
  }
);

/*
 * JOB COMPLETED
 */
emailWorker.on("completed", (job) => {
  console.log(
    `Job ${job.id} completed`
  );

  if (
    job.returnvalue?.rescheduled
  ) {
    console.log(
      `Job ${job.id} completed by rescheduling email ${job.data.emailId}.`
    );
  }
});

/*
 * JOB FAILED
 *
 * This now handles ONLY genuine failures.
 *
 * Hourly rate-limit errors should never
 * reach this handler.
 */
emailWorker.on(
  "failed",
  async (job, error) => {
    console.error(
      `Job ${job?.id} failed:`,
      error.message
    );

    if (!job?.data?.emailId) {
      return;
    }

    const emailId =
      job.data.emailId;

    const maxAttempts =
      job.opts.attempts || 1;

    const attemptsMade =
      job.attemptsMade;

    console.log(
      `Email ${emailId}: attempt ${attemptsMade}/${maxAttempts}`
    );

    /*
     * BullMQ will automatically retry
     * while attempts remain.
     */
    if (
      attemptsMade < maxAttempts
    ) {
      console.log(
        `Email ${emailId} will be retried by BullMQ.`
      );

      return;
    }

    /*
     * ALL RETRIES EXHAUSTED
     */
    try {
      await pool.query(
        `
        UPDATE emails
        SET
          status = 'failed',
          error_message = $1,
          updated_at = NOW()
        WHERE id = $2
          AND status != 'sent'
        `,
        [
          error.message,
          emailId,
        ]
      );

      console.log(
        `Email ${emailId} permanently failed after ${attemptsMade} attempts.`
      );
    } catch (dbError) {
      console.error(
        "Failed to update email failure status:",
        dbError
      );
    }
  }
);

console.log(
  `Email worker started with concurrency: ${concurrency}`
);