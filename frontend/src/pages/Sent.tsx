import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import EmailDetails from "./EmailDetails";
import EmailList from "../components/Email/EmailList";
import { type Email } from "../components/Email/EmailCard";

const API_URL = "http://localhost:5000/api";
const ITEMS_PER_PAGE = 5;

interface BackendAttachment {
  name?: string;
  filename?: string;
  type?: string;
  contentType?: string;
  size?: number;
  path?: string;
  content?: string;
}

interface BackendEmail {
  id: string;
  subject: string;
  recipient_email: string;

  status:
    | "sent"
    | "scheduled"
    | "processing"
    | "failed";

  sender_email?: string;

  sent_at: string | null;
  scheduled_at: string | null;
  created_at: string;

  body?: string;

  ethereal_preview_url: string | null;

  attachments?: BackendAttachment[];
}

interface ApiResponse {
  success: boolean;

  emails: BackendEmail[];

  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

function Sent() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentPage, setCurrentPage] =
    useState(1);

  const [totalPages, setTotalPages] =
    useState(1);

  const [totalEmails, setTotalEmails] =
    useState(0);

  const [selectedEmail, setSelectedEmail] =
    useState<Email | null>(null);

  /*
   * --------------------------------------------------
   * FETCH SENT EMAILS
   * --------------------------------------------------
   */

  useEffect(() => {
    fetchSentEmails();
  }, [currentPage]);

  async function fetchSentEmails() {
    try {
      setLoading(true);
      setError("");

      const token =
        localStorage.getItem("token");

      if (!token) {
        throw new Error(
          "No authentication token found"
        );
      }

      const params =
        new URLSearchParams();

      params.set(
        "status",
        "sent"
      );

      params.set(
        "page",
        String(currentPage)
      );

      params.set(
        "limit",
        String(ITEMS_PER_PAGE)
      );

      const response = await fetch(
        `${API_URL}/emails?${params.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to fetch sent emails"
        );
      }

      const data: ApiResponse =
        await response.json();

      const sentEmails: Email[] =
        data.emails.map(
          (email: BackendEmail) => ({
            id: email.id,

            subject:
              email.subject,

            recipient:
              email.recipient_email,

            status: "sent",

            time: formatEmailTime(
              email.sent_at ||
                email.created_at
            ),
          })
        );

      setEmails(sentEmails);

      setTotalEmails(
        data.pagination.total
      );

      setTotalPages(
        data.pagination.totalPages
      );
    } catch (err) {
      console.error(
        "Failed to fetch sent emails:",
        err
      );

      setError(
        "Unable to load sent emails."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * --------------------------------------------------
   * OPEN EMAIL DETAILS
   * --------------------------------------------------
   */

  async function handleEmailClick(
    email: Email
  ) {
    try {
      setLoading(true);
      setError("");

      const token =
        localStorage.getItem("token");

      if (!token) {
        throw new Error(
          "Authentication required."
        );
      }

      const response = await fetch(
        `${API_URL}/emails/${email.id}`,
        {
          method: "GET",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to load email details."
        );
      }

      const data =
        await response.json();

      const backendEmail: BackendEmail =
        data.email || data;

      const formattedEmail: Email = {
        id:
          backendEmail.id,

        subject:
          backendEmail.subject,

        recipient:
          backendEmail.recipient_email,

        sender:
          backendEmail.sender_email,

        status:
          backendEmail.status ===
          "processing"
            ? "scheduled"
            : backendEmail.status,

        time: formatEmailTime(
          backendEmail.sent_at ||
            backendEmail.scheduled_at ||
            backendEmail.created_at
        ),

        scheduledAt:
          backendEmail.scheduled_at,

        sentAt:
          backendEmail.sent_at,

        body:
          backendEmail.body,

        previewUrl:
          backendEmail.ethereal_preview_url,

        attachments:
          normalizeAttachments(
            backendEmail.attachments
          ),
      };

      setSelectedEmail(
        formattedEmail
      );
    } catch (err) {
      console.error(
        "Failed to open email:",
        err
      );

      /*
       * Fallback to list email
       */
      setSelectedEmail(email);
    } finally {
      setLoading(false);
    }
  }

  /*
   * --------------------------------------------------
   * NORMALIZE ATTACHMENTS
   * --------------------------------------------------
   */

  function normalizeAttachments(
    attachments?: BackendAttachment[]
  ) {
    if (!Array.isArray(attachments)) {
      return [];
    }

    return attachments.map(
      (attachment) => ({
        filename:
          attachment.filename ||
          attachment.name ||
          "Attachment",

        path:
          attachment.path,

        content:
          attachment.content,

        contentType:
          attachment.contentType ||
          attachment.type,

        size:
          attachment.size,
      })
    );
  }

  /*
   * --------------------------------------------------
   * DATE FORMAT
   * --------------------------------------------------
   */

  function formatEmailTime(
    dateString?: string | null
  ) {
    if (!dateString) {
      return "";
    }

    const date =
      new Date(dateString);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    return date.toLocaleString();
  }

  /*
   * --------------------------------------------------
   * PAGINATION
   * --------------------------------------------------
   */

  function goToPage(
    page: number
  ) {
    if (
      page < 1 ||
      page > totalPages
    ) {
      return;
    }

    setCurrentPage(page);
  }

  /*
   * --------------------------------------------------
   * EMAIL DETAILS PAGE
   * --------------------------------------------------
   */

  if (selectedEmail) {
    return (
      <EmailDetails
        email={selectedEmail}
        onBack={() =>
          setSelectedEmail(null)
        }
      />
    );
  }

  /*
   * --------------------------------------------------
   * SENT EMAILS LIST
   * --------------------------------------------------
   */

  return (
    <>
      {/* HEADER */}

      <div className="content-header">
        <h1>Sent</h1>
      </div>

      {/* EMAIL CONTAINER */}

      <div className="email-container">

        {/* LOADING */}

        {loading && (
          <div className="empty-state">
            <Loader2
              size={24}
              className="loading-icon"
            />

            <h3>
              Loading sent emails...
            </h3>
          </div>
        )}

        {/* ERROR */}

        {!loading &&
          error && (
            <div className="empty-state">
              <h3>
                {error}
              </h3>

              <button
                className="schedule-button"
                onClick={
                  fetchSentEmails
                }
              >
                Try Again
              </button>
            </div>
          )}

        {/* NO EMAILS */}

        {!loading &&
          !error &&
          emails.length === 0 && (
            <div className="empty-state">
              <h3>
                No sent emails
              </h3>

              <p>
                No emails have been
                sent yet.
              </p>
            </div>
          )}

        {/* EMAIL LIST */}

        {!loading &&
          !error &&
          emails.length > 0 && (
            <>
              <EmailList
                emails={emails}
                search=""
                onEmailClick={
                  handleEmailClick
                }
              />

              {/* PAGINATION */}

              {totalPages > 1 && (
                <div className="pagination">

                  <div className="pagination-info">
                    Showing{" "}

                    <strong>
                      {(currentPage - 1) *
                        ITEMS_PER_PAGE +
                        1}
                    </strong>

                    {" – "}

                    <strong>
                      {Math.min(
                        currentPage *
                          ITEMS_PER_PAGE,
                        totalEmails
                      )}
                    </strong>

                    {" of "}

                    <strong>
                      {totalEmails}
                    </strong>
                  </div>

                  <div className="pagination-controls">

                    {/* PREVIOUS */}

                    <button
                      className="pagination-button"
                      disabled={
                        currentPage ===
                        1
                      }
                      onClick={() =>
                        goToPage(
                          currentPage - 1
                        )
                      }
                    >
                      Previous
                    </button>

                    {/* PAGE NUMBERS */}

                    <div className="pagination-pages">
                      {Array.from(
                        {
                          length:
                            totalPages,
                        },
                        (_, index) =>
                          index + 1
                      ).map(
                        (page) => (
                          <button
                            key={page}
                            className={`pagination-page ${
                              currentPage ===
                              page
                                ? "active"
                                : ""
                            }`}
                            onClick={() =>
                              goToPage(
                                page
                              )
                            }
                          >
                            {page}
                          </button>
                        )
                      )}
                    </div>

                    {/* NEXT */}

                    <button
                      className="pagination-button"
                      disabled={
                        currentPage ===
                        totalPages
                      }
                      onClick={() =>
                        goToPage(
                          currentPage + 1
                        )
                      }
                    >
                      Next
                    </button>

                  </div>
                </div>
              )}
            </>
          )}

      </div>
    </>
  );
}

export default Sent;