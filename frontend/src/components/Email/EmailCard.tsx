import { Mail, MoreVertical, ExternalLink } from "lucide-react";
import StatusBadge, { type EmailStatus } from "./StatusBadge";

export interface EmailAttachment {
  filename: string;
  path?: string;
  content?: string;
  contentType?: string;
  size?: number;
}

export interface Email {
  id: string;
  subject: string;
  recipient: string;
  status: EmailStatus;
  time: string;
  previewUrl?: string | null;
  body?: string;
  // Email details
  sender?: string;
  scheduledAt?: string | null;
  sentAt?: string | null;
  attachments?: EmailAttachment[];
}

interface EmailCardProps {
  email: Email;
  onClick?: (email: Email) => void;
}

function EmailCard({ email, onClick }: EmailCardProps) {
  const handleOpenEmail = () => {
    if (onClick) {
      onClick(email);
      return;
    }

    if (email.previewUrl) {
      window.open(
        email.previewUrl,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  return (
    <div
      className="email-card"
      onClick={handleOpenEmail}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          handleOpenEmail();
        }
      }}
    >
      <div className="email-icon">
        <Mail size={20} />
      </div>

      <div className="email-info">
        <div className="email-subject">
          {email.subject}
        </div>

        <div className="email-recipient">
          {email.recipient}
        </div>
      </div>

      <div className="email-meta">
        <StatusBadge status={email.status} />

        <span className="email-time">
          {email.time}
        </span>
      </div>

      {email.previewUrl && (
        <ExternalLink
          size={16}
          className="email-preview-icon"
        />
      )}

      <button
        className="more-button"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <MoreVertical size={19} />
      </button>
    </div>
  );
}

export default EmailCard;