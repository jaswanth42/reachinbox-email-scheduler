const API_BASE_URL = "http://localhost:5000/api";

export interface ScheduleEmailInput {
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
}

export interface ScheduledEmail {
  id: string;
  sender_id: string;
  recipient_email: string;
  subject: string;
  body: string;
  scheduled_at: string;
  sent_at: string | null;
  status: "scheduled" | "processing" | "sent" | "failed";
  attempts: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  bullmq_job_id: string | null;
}

export async function scheduleEmail(
  data: ScheduleEmailInput
) {
  const response = await fetch(
    `${API_BASE_URL}/emails/schedule`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.message || "Failed to schedule email"
    );
  }

  return result;
}

export async function searchEmails(query: string) {
  const response = await fetch(
    `${API_BASE_URL}/emails/search?q=${encodeURIComponent(query)}`
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.message || "Failed to search emails"
    );
  }

  return result;
}