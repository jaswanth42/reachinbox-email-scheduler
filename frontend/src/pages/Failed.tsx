import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import EmailList from "../components/Email/EmailList";
import { type Email } from "../components/Email/EmailCard";

const API_URL = "http://localhost:5000/api";

interface BackendEmail {
  id: string;
  subject: string;
  recipient_email: string;
  status: "sent" | "scheduled" | "processing" | "failed";
  sent_at: string | null;
  scheduled_at: string;
  created_at: string;
}

function Failed() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchFailedEmails();
  }, []);

  async function fetchFailedEmails() {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");

        const response = await fetch(
        `${API_URL}/emails?status=failed`,
        {
            headers: {
            Authorization: `Bearer ${token}`,
            },
        }
        );

      if (!response.ok) {
        throw new Error("Failed to fetch emails");
      }

      const data = await response.json();

      const failedEmails: Email[] = data.emails.map(
        (email: BackendEmail) => ({
            id: email.id,
            subject: email.subject,
            recipient: email.recipient_email,
            status: "failed",
            time: formatEmailTime(email.created_at),
        })
        );

      setEmails(failedEmails);
    } catch (err) {
      console.error(err);
      setError("Unable to load failed emails.");
    } finally {
      setLoading(false);
    }
  }

  function formatEmailTime(dateString: string) {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleString();
  }

  return (
    <>
      <div className="content-header">
        <h1>Failed</h1>
      </div>

      <div className="email-container">
        {loading ? (
          <div className="empty-state">
            <Loader2 size={24} className="loading-icon" />
            <h3>Loading failed emails...</h3>
          </div>
        ) : error ? (
          <div className="empty-state">
            <h3>{error}</h3>

            <button
              className="schedule-button"
              onClick={fetchFailedEmails}
            >
              Try Again
            </button>
          </div>
        ) : emails.length === 0 ? (
          <div className="empty-state">
            <h3>No failed emails</h3>
            <p>There are no failed emails.</p>
          </div>
        ) : (
          <EmailList
            emails={emails}
            search=""
          />
        )}
      </div>
    </>
  );
}

export default Failed;