import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  ChevronDown,
  SlidersHorizontal,
  Loader2,
} from "lucide-react";

import EmailDetails from "./EmailDetails";
import EmailList from "../components/Email/EmailList";

import {
  type Email,
  type EmailAttachment,
} from "../components/Email/EmailCard";

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
  body: string;

  status:
    | "sent"
    | "scheduled"
    | "processing"
    | "failed";

  sender_email?: string;

  sent_at: string | null;
  scheduled_at: string | null;
  created_at: string;

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

interface OutletContext {
  search: string;
}

function AllEmails() {
  const { search } =
    useOutletContext<OutletContext>();

  const [emails, setEmails] =
    useState<Email[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [currentPage, setCurrentPage] =
    useState(1);

  const [totalPages, setTotalPages] =
    useState(1);

  const [totalEmails, setTotalEmails] =
    useState(0);

  const [selectedEmail, setSelectedEmail] =
    useState<Email | null>(null);

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [showFilter, setShowFilter] =
    useState(false);

  /*
   * --------------------------------------------------
   * FETCH EMAILS
   * --------------------------------------------------
   */

  useEffect(() => {
    fetchEmails();
  }, [
    currentPage,
    search,
    statusFilter,
  ]);

  /*
   * Reset page when search/filter changes.
   */

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    statusFilter,
  ]);

  async function fetchEmails() {
    try {
      setLoading(true);
      setError("");

      const params =
        new URLSearchParams();

      params.set(
        "page",
        String(currentPage)
      );

      params.set(
        "limit",
        String(ITEMS_PER_PAGE)
      );

      if (statusFilter !== "all") {
        params.set(
          "status",
          statusFilter
        );
      }

      if (search.trim()) {
        params.set(
          "search",
          search.trim()
        );
      }

      const token =
        localStorage.getItem("token");

      if (!token) {
        throw new Error(
          "No authentication token found"
        );
      }

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
          "Failed to fetch emails"
        );
      }

      const data: ApiResponse =
        await response.json();

      /*
       * Convert backend emails into
       * frontend Email objects.
       */

      const formattedEmails: Email[] =
        data.emails.map((email) => ({
          id: email.id,

          subject:
            email.subject,

          recipient:
            email.recipient_email,

          status:
            email.status === "processing"
              ? "scheduled"
              : email.status,

          time:
            formatEmailTime(
              email.sent_at ||
                email.scheduled_at ||
                email.created_at
            ),

          sender:
            email.sender_email,

          scheduledAt:
            email.scheduled_at,

          sentAt:
            email.sent_at,

          body:
            email.body,

          previewUrl:
            email.ethereal_preview_url,

          attachments:
            normalizeAttachments(
              email.attachments
            ),
        }));

      setEmails(
        formattedEmails
      );

      setTotalEmails(
        data.pagination.total
      );

      setTotalPages(
        data.pagination.totalPages
      );
    } catch (err) {
      console.error(
        "Failed to fetch emails:",
        err
      );

      setError(
        "Unable to load emails."
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

      /*
       * Convert backend email into
       * the SAME Email interface.
       */

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

        time:
          formatEmailTime(
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
       * Fallback to the email already
       * available in the list.
       */

      setSelectedEmail({
        ...email,
        attachments:
          email.attachments || [],
      });
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
  ): EmailAttachment[] {
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
   * BACK TO EMAIL LIST
   * --------------------------------------------------
   */

  function handleBack() {
    setSelectedEmail(null);
    setError("");
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
   * EMAIL DETAILS PAGE
   * --------------------------------------------------
   */

  if (selectedEmail) {
    return (
      <EmailDetails
        email={selectedEmail}
        onBack={handleBack}
      />
    );
  }

  /*
   * --------------------------------------------------
   * ALL EMAILS LIST
   * --------------------------------------------------
   */

  return (
    <>
      {/* HEADER */}

      <div className="content-header">
        <div>
          <h1>
            All Emails
          </h1>

          {search.trim() && (
            <p
              style={{
                margin: "5px 0 0",
                fontSize: "13px",
                color: "#8b92a2",
              }}
            >
              Search results for "{search}"
            </p>
          )}
        </div>

        <div className="content-actions">
          <div className="filter-wrapper">
            <button
              className="control-button"
              onClick={() =>
                setShowFilter(
                  (prev) => !prev
                )
              }
            >
              <SlidersHorizontal
                size={15}
              />

              Filter

              <ChevronDown
                size={14}
              />
            </button>

            {showFilter && (
              <div className="filter-dropdown">

                <button
                  className={
                    statusFilter === "all"
                      ? "selected"
                      : ""
                  }
                  onClick={() => {
                    setStatusFilter(
                      "all"
                    );

                    setShowFilter(
                      false
                    );
                  }}
                >
                  All
                </button>

                <button
                  className={
                    statusFilter === "sent"
                      ? "selected"
                      : ""
                  }
                  onClick={() => {
                    setStatusFilter(
                      "sent"
                    );

                    setShowFilter(
                      false
                    );
                  }}
                >
                  Sent
                </button>

                <button
                  className={
                    statusFilter ===
                    "scheduled"
                      ? "selected"
                      : ""
                  }
                  onClick={() => {
                    setStatusFilter(
                      "scheduled"
                    );

                    setShowFilter(
                      false
                    );
                  }}
                >
                  Scheduled
                </button>

                <button
                  className={
                    statusFilter === "failed"
                      ? "selected"
                      : ""
                  }
                  onClick={() => {
                    setStatusFilter(
                      "failed"
                    );

                    setShowFilter(
                      false
                    );
                  }}
                >
                  Failed
                </button>

              </div>
            )}
          </div>
        </div>
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
              Loading emails...
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
                  fetchEmails
                }
              >
                Try Again
              </button>

            </div>
          )}

        {/* NO RESULTS */}

        {!loading &&
          !error &&
          emails.length === 0 && (
            <div className="empty-state">

              <h3>
                {search.trim()
                  ? "No matching emails"
                  : "No emails found"}
              </h3>

              <p>
                {search.trim()
                  ? `No emails match "${search}".`
                  : "There are no emails to display."}
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

export default AllEmails;