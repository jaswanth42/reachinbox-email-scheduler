import redisConnection from "../config/redis.js";

const DEFAULT_MIN_EMAIL_DELAY_MS =
  Number(process.env.MIN_EMAIL_DELAY_MS) || 2000;

const DEFAULT_MAX_EMAILS_PER_HOUR =
  Number(process.env.MAX_EMAILS_PER_HOUR) || 200;

export async function acquireSendSlot(
  senderId: string,
  hourlyLimit?: number,
  delayBetweenEmails?: number
) {
  const maxEmailsPerHour =
    hourlyLimit && hourlyLimit > 0
      ? hourlyLimit
      : DEFAULT_MAX_EMAILS_PER_HOUR;

  const minEmailDelay =
    delayBetweenEmails && delayBetweenEmails > 0
      ? delayBetweenEmails
      : DEFAULT_MIN_EMAIL_DELAY_MS;

  /*
   * --------------------------------------------------
   * 1. Minimum delay between emails for this sender
   * --------------------------------------------------
   */

  const delayKey =
    `email:send:last:${senderId}`;

  while (true) {
    const lastSend =
      await redisConnection.get(delayKey);

    const lastSendTime =
      lastSend ? Number(lastSend) : 0;

    const nextAvailableTime =
      lastSendTime + minEmailDelay;

    const currentTime = Date.now();

    if (currentTime < nextAvailableTime) {
      const waitTime =
        nextAvailableTime - currentTime;

      console.log(
        `Sender ${senderId} throttled. Waiting ${waitTime}ms`
      );

      await new Promise((resolve) =>
        setTimeout(resolve, waitTime)
      );

      continue;
    }

    /*
     * Try to reserve this send slot atomically.
     */
    await redisConnection.watch(delayKey);

    const latestLastSend =
      await redisConnection.get(delayKey);

    const latestTime =
      latestLastSend
        ? Number(latestLastSend)
        : 0;

    const latestNextTime =
      latestTime + minEmailDelay;

    const current = Date.now();

    if (current < latestNextTime) {
      await redisConnection.unwatch();

      const waitTime =
        latestNextTime - current;

      await new Promise((resolve) =>
        setTimeout(resolve, waitTime)
      );

      continue;
    }

    const slotTime = Math.max(
      current,
      latestNextTime
    );

    const transaction =
      redisConnection.multi();

    transaction.set(
      delayKey,
      String(slotTime),
      "PX",
      60 * 60 * 1000
    );

    const result =
      await transaction.exec();

    if (result !== null) {
      break;
    }
  }

  /*
   * --------------------------------------------------
   * 2. Hourly limit
   * --------------------------------------------------
   */

  const hourWindow = Math.floor(
    Date.now() /
      (60 * 60 * 1000)
  );

  const hourlyKey =
    `email:rate:${senderId}:${hourWindow}`;

  const count =
    await redisConnection.incr(hourlyKey);

  /*
   * First counter gets a one-hour expiration.
   */
  if (count === 1) {
    await redisConnection.expire(
      hourlyKey,
      60 * 60
    );
  }

  /*
   * Check against the Compose-configured limit.
   */
  if (count > maxEmailsPerHour) {
    /*
     * Undo our reservation because
     * we cannot send yet.
     */
    await redisConnection.decr(
      hourlyKey
    );

    throw new Error(
      `HOURLY_RATE_LIMIT:${senderId}`
    );
  }

  console.log(
    `Send slot acquired for sender ${senderId}. Hourly count: ${count}/${maxEmailsPerHour}`
  );
}