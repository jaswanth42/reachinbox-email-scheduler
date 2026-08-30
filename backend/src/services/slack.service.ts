import axios from "axios";
import pool from "../config/database.js";
import redisConnection from "../config/redis.js";

interface SlackConnection {
  access_token: string;
  slack_channel_id: string | null;
  slack_team_name: string | null;
}

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID;

export async function getSlackConnection(
  userId: string
): Promise<SlackConnection | null> {
  const result = await pool.query(
    `
    SELECT
      access_token,
      slack_channel_id,
      slack_team_name
    FROM slack_connections
    WHERE user_id = $1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

export async function saveSlackConnection(params: {
  userId: string;
  teamId: string;
  teamName?: string | null;
  botUserId?: string | null;
  channelId?: string | null;
  accessToken: string;
}) {
  const result = await pool.query(
    `
    INSERT INTO slack_connections
      (
        user_id,
        slack_team_id,
        slack_team_name,
        slack_bot_user_id,
        slack_channel_id,
        access_token
      )
    VALUES ($1, $2, $3, $4, $5, $6)

    ON CONFLICT (user_id)
    DO UPDATE SET
      slack_team_id = EXCLUDED.slack_team_id,
      slack_team_name = EXCLUDED.slack_team_name,
      slack_bot_user_id = EXCLUDED.slack_bot_user_id,
      slack_channel_id = EXCLUDED.slack_channel_id,
      access_token = EXCLUDED.access_token,
      updated_at = NOW()

    RETURNING
      slack_team_id,
      slack_team_name,
      slack_channel_id,
      connected_at
    `,
    [
      params.userId,
      params.teamId,
      params.teamName || null,
      params.botUserId || null,
      params.channelId || null,
      params.accessToken,
    ]
  );

  return result.rows[0];
}

export async function disconnectSlack(userId: string) {
  await pool.query(
    `
    DELETE FROM slack_connections
    WHERE user_id = $1
    `,
    [userId]
  );
}

export async function sendSlackRateLimitNotification(
  userId: string,
  emailId: string,
  senderId: string
) {
  /*
   * --------------------------------------------------
   * 1. Try OAuth connection first
   * --------------------------------------------------
   */

  const connection = await getSlackConnection(userId);

  let accessToken: string | undefined;
  let channelId: string | null = null;

  if (
    connection?.access_token &&
    connection.slack_channel_id
  ) {
    accessToken = connection.access_token;
    channelId = connection.slack_channel_id;

    console.log(
      `[SLACK] OAuth connection found: true, channel=${channelId}`
    );
  } else {
    /*
     * --------------------------------------------------
     * 2. Fallback to environment configuration
     * --------------------------------------------------
     */

    accessToken = SLACK_BOT_TOKEN;
    channelId = SLACK_CHANNEL_ID || null;

    console.log(
      `[SLACK] OAuth connection found: false, using environment configuration`
    );

    console.log(
      `[SLACK] Environment channel=${channelId || "NONE"}`
    );
  }

  /*
   * --------------------------------------------------
   * 3. Make sure Slack is configured
   * --------------------------------------------------
   */

  if (!accessToken || !channelId) {
    console.log(
      "[SLACK] Skipping notification because Slack is not configured"
    );

    return {
      skipped: true,
      reason: "slack_not_configured",
    };
  }

  /*
   * --------------------------------------------------
   * 4. Only notify once per sender per hour
   * --------------------------------------------------
   */

  const hourWindow = Math.floor(
    Date.now() / (60 * 60 * 1000)
  );

  const notificationKey =
    `slack:rate-limit-notified:${senderId}:${hourWindow}`;

  const acquired = await redisConnection.set(
    notificationKey,
    "1",
    "EX",
    60 * 60,
    "NX"
  );

  /*
   * Another worker already sent the notification.
   */

  if (acquired !== "OK") {
    console.log(
      `[SLACK] Notification already sent for sender ${senderId} this hour`
    );

    return {
      skipped: true,
      reason: "already_notified_this_hour",
    };
  }

  /*
   * --------------------------------------------------
   * 5. Send Slack message
   * --------------------------------------------------
   */

  try {
    const response = await axios.post(
      "https://slack.com/api/chat.postMessage",
      {
        channel: channelId,

        text:
          `⚠️ *Email hourly rate limit reached*\n\n` +
          `Email ID: \`${emailId}\`\n` +
          `Sender ID: \`${senderId}\`\n\n` +
          `The email has been rescheduled for the beginning of the next hour.`,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    /*
     * Slack can return HTTP 200 even when the API
     * itself rejects the request.
     */

    if (!response.data?.ok) {
      throw new Error(
        response.data?.error ||
          "Slack API rejected the message"
      );
    }

    console.log(
      `[SLACK] Rate-limit notification sent successfully`
    );

    console.log(
      `[SLACK] Sender: ${senderId}`
    );

    console.log(
      `[SLACK] Email: ${emailId}`
    );

    return {
      sent: true,
    };
  } catch (error) {
    /*
     * Slack failed.
     *
     * Remove the Redis key so another attempt can
     * send the notification.
     */

    await redisConnection.del(notificationKey);

    console.error(
      "[SLACK] Failed to send rate-limit notification:",
      error
    );

    return {
      sent: false,
    };
  }
}