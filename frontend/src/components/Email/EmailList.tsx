import { Mail } from "lucide-react";
import EmailCard, { type Email } from "./EmailCard";

interface EmailListProps {
  emails: Email[];
  search: string;
  onEmailClick?: (email: Email) => void;
}

function EmailList({
  emails,
  search,
  onEmailClick,
}: EmailListProps) {
  if (emails.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <Mail size={24} />
        </div>

        <h3>No emails found</h3>

        <p>
          {search
            ? "Try a different search."
            : "There are no emails in this folder yet."}
        </p>
      </div>
    );
  }

  return (
    <>
      {emails.map((email) => (
        <EmailCard
          key={email.id}
          email={email}
          onClick={onEmailClick}
        />
      ))}
    </>
  );
}

export default EmailList;