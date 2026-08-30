import {
  ArrowLeft,
  ExternalLink,
  Paperclip,
} from "lucide-react";

import StatusBadge from "../components/Email/StatusBadge";
import type {
  Email,
} from "../components/Email/EmailCard";

interface EmailDetailsProps {
  email: Email;
  onBack: () => void;
}

function EmailDetails({
  email,
  onBack,
}: EmailDetailsProps) {
  function formatFileSize(size?: number) {
    if (
      size === undefined ||
      size === null
    ) {
      return "";
    }

    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(
      size /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }

  return (
    <div className="compose-page">

      {/* TOP BAR */}
      <div className="compose-topbar">
        <button
          type="button"
          className="compose-back"
          onClick={onBack}
        >
          <ArrowLeft size={14} />

          <span>
            Back to All Emails
          </span>
        </button>

        <div className="compose-top-actions">
          {email.previewUrl && (
            <button
              type="button"
              className="compose-send-button"
              onClick={() =>
                window.open(
                  email.previewUrl!,
                  "_blank",
                  "noopener,noreferrer"
                )
              }
            >
              <ExternalLink size={13} />

              <span>
                Open Preview
              </span>
            </button>
          )}
        </div>
      </div>

      {/* EMAIL CONTENT */}
      <main className="compose-content">
        <div className="compose-form">

          {/* SUBJECT */}
          <div className="compose-field-row">
            <div className="compose-field-label">
              Subject
            </div>

            <div className="compose-field-control">
              <div className="compose-input">
                {email.subject || "No subject"}
              </div>
            </div>
          </div>

          {/* FROM */}
          <div className="compose-field-row">
            <div className="compose-field-label">
              From
            </div>

            <div className="compose-field-control">
              <div className="compose-input">
                {email.sender || "Unknown sender"}
              </div>
            </div>
          </div>

          {/* TO */}
          <div className="compose-field-row">
            <div className="compose-field-label">
              To
            </div>

            <div className="compose-field-control">
              <div className="recipient-area">
                <div className="recipient-chips">
                  <span className="recipient-chip">
                    {email.recipient}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* STATUS */}
          <div className="compose-field-row">
            <div className="compose-field-label">
              Status
            </div>

            <div
              className="compose-field-control"
              style={{
                display: "flex",
                alignItems: "center",
              }}
            >
              <StatusBadge
                status={email.status}
              />
            </div>
          </div>

          {/* TIME */}
          <div className="compose-field-row">
            <div className="compose-field-label">
              Time
            </div>

            <div className="compose-field-control">
              <div className="compose-input">
                {email.time || "—"}
              </div>
            </div>
          </div>

          {/* MESSAGE */}
          <div className="compose-message">
            <div
              className="compose-editor"
              style={{
                minHeight: "300px",
                whiteSpace: "pre-wrap",
              }}
              dangerouslySetInnerHTML={{
                __html:
                  email.body ||
                  "No email body available.",
              }}
            />
          </div>

          {/* ATTACHMENTS */}
          {email.attachments &&
            email.attachments.length > 0 && (
              <div className="attachments-section">

                <div className="attachments-title">
                  Attachments
                </div>

                <div className="attachments-list">
                  {email.attachments.map(
                    (attachment, index) => (
                      <div
                        className="attachment-item"
                        key={`${attachment.filename}-${index}`}
                      >
                        <Paperclip size={13} />

                        <span>
                          {attachment.filename}
                        </span>

                        {attachment.size !==
                          undefined && (
                          <span
                            style={{
                              marginLeft: "auto",
                              fontSize: "11px",
                              opacity: 0.6,
                            }}
                          >
                            {formatFileSize(
                              attachment.size
                            )}
                          </span>
                        )}
                      </div>
                    )
                  )}
                </div>

              </div>
            )}

        </div>
      </main>
    </div>
  );
}

export default EmailDetails;