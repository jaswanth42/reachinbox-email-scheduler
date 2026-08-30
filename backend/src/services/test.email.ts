import { sendEmail } from "./email.sender.js";

async function testEmail() {
  try {
    await sendEmail(
      "test@example.com",
      "ReachInbox Ethereal Test",
      "This email was sent through Ethereal SMTP."
    );

    console.log("SMTP test completed successfully.");
  } catch (error) {
    console.error("SMTP test failed:", error);
  }
}

testEmail();