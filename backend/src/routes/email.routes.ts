import { Router } from "express";

import { authMiddleware } from "../middleware/auth.middleware.js";
import { scheduleEmail } from "../services/email.service.js";
import { searchEmails } from "../services/email.search.js";
import pool from "../config/database.js";

const router = Router();

/*
 * GET /api/emails
 *
 * Supports:
 * ?page=1
 * ?limit=5
 * ?status=sent
 * ?search=test
 * ?sort=newest
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = (
      req as typeof req & {
        authUser: {
          userId: string;
          email: string;
        };
      }
    ).authUser.userId;

    const page = Math.max(
      1,
      Number.parseInt(String(req.query.page || "1"), 10)
    );

    const limit = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(String(req.query.limit || "10"), 10)
      )
    );

    const status =
      typeof req.query.status === "string"
        ? req.query.status.trim().toLowerCase()
        : "";

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const sort =
      typeof req.query.sort === "string"
        ? req.query.sort.toLowerCase()
        : "newest";

    const allowedStatuses = [
      "scheduled",
      "sent",
      "failed",
      "processing",
    ];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const offset = (page - 1) * limit;

    const conditions: string[] = [
      "s.user_id = $1",
    ];

    const values: unknown[] = [userId];

    /*
     * STATUS FILTER
     */
    if (status) {
      values.push(status);

      conditions.push(
        `e.status = $${values.length}`
      );
    }

    /*
     * SEARCH FILTER
     */
    if (search) {
      values.push(`%${search}%`);

      conditions.push(`
        (
          e.subject ILIKE $${values.length}
          OR e.recipient_email ILIKE $${values.length}
          OR e.body ILIKE $${values.length}
        )
      `);
    }

    const whereClause =
      `WHERE ${conditions.join(" AND ")}`;

    /*
     * SORTING
     */
    const orderBy =
      sort === "oldest"
        ? "e.created_at ASC"
        : "e.created_at DESC";

    /*
     * COUNT
     */
    const countResult = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM emails e
      INNER JOIN senders s
        ON e.sender_id = s.id
      ${whereClause}
      `,
      values
    );

    const total = countResult.rows[0].total;

    /*
     * FETCH EMAILS
     */
    const dataValues = [
      ...values,
      limit,
      offset,
    ];

    const limitPosition =
      values.length + 1;

    const offsetPosition =
      values.length + 2;

    const result = await pool.query(
      `
      SELECT
        e.id,
        e.sender_id,
        s.email AS sender_email,
        e.recipient_email,
        e.subject,
        e.body,
        e.scheduled_at,
        e.sent_at,
        e.status,
        e.attempts,
        e.error_message,
        e.ethereal_preview_url,
        e.attachments,
        e.created_at,
        e.updated_at
      FROM emails e
      INNER JOIN senders s
        ON e.sender_id = s.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${limitPosition}
      OFFSET $${offsetPosition}
      `,
      dataValues
    );

    const totalPages = Math.max(
      1,
      Math.ceil(total / limit)
    );

    return res.json({
      success: true,

      emails: result.rows,

      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage:
          page < totalPages,
        hasPreviousPage:
          page > 1,
      },

      filters: {
        status: status || "all",
        search,
        sort,
      },
    });
  } catch (error) {
    console.error(
      "Get emails error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch emails",
    });
  }
});

/*
 * POST /api/emails/schedule
 *
 * New Compose payload:
 *
 * {
 *   fromEmail,
 *   recipients: string[],
 *   subject,
 *   body,
 *   scheduledAt,
 *   delayBetweenEmails,
 *   hourlyLimit,
 *   attachments
 * }
 */
router.post(
  "/schedule",
  authMiddleware,
  async (req, res) => {
    try {
      const userId = (
        req as typeof req & {
          authUser: {
            userId: string;
            email: string;
          };
        }
      ).authUser.userId;

      const {
        fromEmail,
        recipients,
        subject,
        body,
        scheduledAt,
        delayBetweenEmails,
        hourlyLimit,
        attachments,
      } = req.body;

      /*
       * -----------------------------------------
       * VALIDATION
       * -----------------------------------------
       */

      if (
        !recipients ||
        !Array.isArray(recipients) ||
        recipients.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "At least one recipient is required",
        });
      }

      if (
        !subject ||
        !String(subject).trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Subject is required",
        });
      }

      if (
        !body ||
        !String(body).trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Message body is required",
        });
      }

      if (!scheduledAt) {
        return res.status(400).json({
          success: false,
          message:
            "scheduledAt is required",
        });
      }

      /*
       * -----------------------------------------
       * VALIDATE EMAIL ADDRESSES
       * -----------------------------------------
       */

      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      const cleanedRecipients =
        recipients.map(
          (email: unknown) =>
            String(email)
              .trim()
              .toLowerCase()
        );

      const invalidRecipients =
        cleanedRecipients.filter(
          (email: string) =>
            !emailRegex.test(email)
        );

      if (
        invalidRecipients.length > 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "One or more recipient email addresses are invalid",
          invalidRecipients,
        });
      }

      /*
       * Remove duplicate recipients
       */
      const uniqueRecipients =
        Array.from(
          new Set(cleanedRecipients)
        );

      if (
        uniqueRecipients.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "At least one valid recipient is required",
        });
      }

      /*
       * -----------------------------------------
       * SCHEDULED DATE
       * -----------------------------------------
       */

      const scheduledDate =
        new Date(scheduledAt);

      if (
        Number.isNaN(
          scheduledDate.getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid scheduledAt",
        });
      }

      if (
        scheduledDate.getTime() <=
        Date.now()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "scheduledAt must be in the future",
        });
      }

      /*
       * -----------------------------------------
       * SETTINGS
       * -----------------------------------------
       */

      const parsedDelay =
        Number(delayBetweenEmails) || 0;

      const parsedHourlyLimit =
        Number(hourlyLimit) || 0;

      if (parsedDelay < 0) {
        return res.status(400).json({
          success: false,
          message:
            "delayBetweenEmails cannot be negative",
        });
      }

      if (parsedHourlyLimit < 0) {
        return res.status(400).json({
          success: false,
          message:
            "hourlyLimit cannot be negative",
        });
      }

      /*
       * -----------------------------------------
       * ATTACHMENTS
       * -----------------------------------------
       */

      const emailAttachments =
        Array.isArray(attachments)
          ? attachments
          : [];

      /*
       * -----------------------------------------
       * CREATE EMAIL CAMPAIGN
       *
       * IMPORTANT:
       * scheduleEmail() now accepts ALL
       * recipients at once.
       * -----------------------------------------
       */

      const campaign =
        await scheduleEmail({
          senderId: userId,

          fromEmail:
            fromEmail ||
            undefined,

          recipients:
            uniqueRecipients,

          subject:
            String(subject).trim(),

          body:
            String(body),

          scheduledAt:
            scheduledDate,

          delayBetweenEmails:
            parsedDelay,

          hourlyLimit:
            parsedHourlyLimit,

          attachments:
            emailAttachments,
        });

      /*
       * -----------------------------------------
       * RESPONSE
       * -----------------------------------------
       */

      return res.status(201).json({
        success: true,

        message:
          "Email campaign scheduled successfully",

        campaign: {
          sender:
            campaign.sender,

          recipientCount:
            campaign.totalRecipients,

          recipients:
            campaign.recipients,

          scheduledAt:
            campaign.scheduledAt,

          delayBetweenEmails:
            campaign.delayBetweenEmails,

          hourlyLimit:
            campaign.hourlyLimit,

          attachments:
            emailAttachments,

          attachmentsCount:
            campaign.attachmentsCount,
        },

        emails:
          campaign.emails,
      });
    } catch (error) {
      console.error(
        "Schedule email error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to schedule email",
      });
    }
  }
);

/*
 * GET /api/emails/search
 *
 * Elasticsearch search.
 */
router.get(
  "/search",
  authMiddleware,
  async (req, res) => {
    try {
      const query =
        typeof req.query.q === "string"
          ? req.query.q.trim()
          : "";

      if (!query) {
        return res.status(400).json({
          success: false,
          message:
            "Search query is required",
        });
      }

      const results =
        await searchEmails(query);

      return res.json({
        success: true,
        query,
        results,
      });
    } catch (error) {
      console.error(
        "Search emails error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to search emails",
      });
    }
  }
);

export default router;