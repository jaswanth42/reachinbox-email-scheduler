import { Check } from "lucide-react";

export type EmailStatus = "sent" | "scheduled" | "failed";

interface StatusBadgeProps {
  status: EmailStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  if (status === "sent") {
    return (
      <span className="status-badge sent">
        Sent
        <Check size={13} />
      </span>
    );
  }

  if (status === "scheduled") {
    return (
      <span className="status-badge scheduled">
        Scheduled
      </span>
    );
  }

  return (
    <span className="status-badge failed">
      Failed
    </span>
  );
}

export default StatusBadge;