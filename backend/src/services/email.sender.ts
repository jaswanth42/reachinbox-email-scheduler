import dotenv from "dotenv";

dotenv.config();

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

interface EmailAttachment {
  filename: string;
  path?: string;
  content?: Buffer;
  contentType?: string;
}

export async function sendEmail(
  recipient: string,
  subject: string,
  body: string,
  attachments: EmailAttachment[] = []
) {
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: recipient,
    subject,
    text: body,

    /*
     * Attachments
     *
     * This is optional so existing emails without
     * attachments continue to work.
     */
    attachments,
  });

  console.log("Email sent successfully");
  console.log("Message ID:", info.messageId);

  const previewUrl =
    nodemailer.getTestMessageUrl(info);

  console.log(
    "Ethereal preview:",
    previewUrl
  );

  return {
    info,
    previewUrl: previewUrl || null,
  };
}