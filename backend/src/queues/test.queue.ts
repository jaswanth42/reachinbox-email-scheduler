import dotenv from "dotenv";
dotenv.config();

import { emailQueue } from "./email.queue.js";

async function createTestJob() {
  try {
    const job = await emailQueue.add(
      "test-email",
      {
        recipient: "test@example.com",
        subject: "BullMQ Test",
      },
      {
        delay: 60_000,
      }
    );

    console.log(`Job created: ${job.id}`);
    console.log("Job will run after 60 seconds.");
  } catch (error) {
    console.error("Failed to create test job:", error);
  }
}

createTestJob();