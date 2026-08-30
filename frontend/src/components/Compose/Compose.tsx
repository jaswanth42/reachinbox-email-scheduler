import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Paperclip,
  Upload,
  Clock3,
  Send,
  X,
  Check,
  Loader2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Link,
  Image as ImageIcon,
  ChevronDown,
  CalendarDays,
} from "lucide-react";

import "./Compose.css";

interface Sender {
  id: string;
  email: string;
  displayName?: string | null;
}

interface ComposeProps {
  onClose: () => void;
  senders: Sender[];
}
interface Attachment {
  id: string;
  file: File;
}

const API_URL = "http://localhost:5000/api";

function Compose({ onClose, senders: providedSenders }: ComposeProps) {
  const [senders, setSenders] = useState<Sender[]>(providedSenders);
  const [fromEmail, setFromEmail] = useState("");
  const [csvCount, setCsvCount] = useState(0);

  // Load sender addresses from the authenticated account.
  // The parent may provide them, but Compose also fetches them directly
  // so the list is available immediately after login without a full reload.
  useEffect(() => {
    setSenders(providedSenders);
  }, [providedSenders]);

  useEffect(() => {
    const loadSenders = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setSenders([]);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/senders`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Failed to load senders");
        }

        if (Array.isArray(data?.senders)) {
          setSenders(data.senders);
        }
      } catch (error) {
        console.error("Load senders error:", error);
      }
    };

    loadSenders();
  }, []);

  useEffect(() => {
    if (senders.length > 0) {
      setFromEmail((current) =>
        senders.some((sender) => sender.email === current)
          ? current
          : senders[0].email
      );
    } else {
      setFromEmail("");
    }
  }, [senders]);

  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const [delay, setDelay] = useState("00");
  const [hourlyLimit, setHourlyLimit] = useState("00");

  const [showSendLater, setShowSendLater] = useState(false);

  const [sendDate, setSendDate] = useState("");
  const [sendTime, setSendTime] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const csvInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);


  /*
   * --------------------------------------------------
   * RECIPIENT EMAIL
   * --------------------------------------------------
   */

  function addRecipient(email: string) {
    const cleanedEmail = email.trim();

    if (!cleanedEmail) {
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleanedEmail)) {
      setError(`Invalid email address: ${cleanedEmail}`);
      return;
    }

    if (recipients.includes(cleanedEmail)) {
      setRecipientInput("");
      return;
    }

    setRecipients((current) => [...current, cleanedEmail]);
    setRecipientInput("");
    setError("");
  }

  function removeRecipient(email: string) {
    setRecipients((current) =>
      current.filter((item) => item !== email)
    );
  }

  function handleRecipientKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (
      event.key === "Enter" ||
      event.key === "," ||
      event.key === " "
    ) {
      event.preventDefault();

      if (recipientInput.trim()) {
        addRecipient(recipientInput);
      }
    }
  }

  /*
   * --------------------------------------------------
   * CSV UPLOAD
   * --------------------------------------------------
   */

  async function handleCsvUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      !file.name.toLowerCase().endsWith(".csv")
    ) {
      setError("Please upload a CSV file.");
      return;
    }

    try {
      const text = await file.text();

      const values = text
        .split(/[\n,;\r]+/)
        .map((value) => value.trim())
        .filter(Boolean);

      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      const validEmails = values.filter((value) =>
        emailRegex.test(value)
      );

      const uniqueEmails = Array.from(
        new Set([...recipients, ...validEmails])
      );

      setRecipients(uniqueEmails);
      setCsvCount(validEmails.length);
      
      if (validEmails.length === 0) {
        setError(
          "No valid email addresses were found in the CSV."
        );
      } else {
        setError("");
      }
    } catch (uploadError) {
      console.error(uploadError);

      setError(
        "Failed to read the CSV file."
      );
    }

    event.target.value = "";
  }

  /*
   * --------------------------------------------------
   * ATTACHMENTS
   * --------------------------------------------------
   */

  function handleAttachmentUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = event.target.files;

    if (!files) {
      return;
    }

    const newAttachments: Attachment[] =
      Array.from(files).map((file) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
      }));

    setAttachments((current) => [
      ...current,
      ...newAttachments,
    ]);

    event.target.value = "";
  }

  function removeAttachment(id: string) {
    setAttachments((current) =>
      current.filter((attachment) => attachment.id !== id)
    );
  }

  /*
   * --------------------------------------------------
   * EDITOR
   * --------------------------------------------------
   */

  function executeCommand(command: string) {
    document.execCommand(command, false);
  }

  /*
   * --------------------------------------------------
   * SEND
   * --------------------------------------------------
   */

  async function handleSend() {
    setError("");
    setSuccess("");

    if (!fromEmail.trim()) {
      setError("Please select a sender email.");
      return false;
    }

    if (recipients.length === 0) {
      setError("Please add at least one recipient.");
      return;
    }

    if (!subject.trim()) {
      setError("Please enter a subject.");
      return;
    }

    if (!body.trim()) {
      setError("Please enter a message.");
      return;
    }

    try {
      setLoading(true);

      const token =
        localStorage.getItem("token");

      if (!token) {
        throw new Error(
          "Authentication required. Please login again."
        );
      }

      /*
       * Frontend payload.
       *
       * Backend can be updated to accept this
       * structure in the next step.
       */
      const payload = {
        fromEmail,
        recipients,
        subject: subject.trim(),
        body,
        delayBetweenEmails: Number(delay) || 0,
        hourlyLimit: Number(hourlyLimit) || 0,
        attachments: attachments.map(
          (attachment) => ({
            name: attachment.file.name,
            type: attachment.file.type,
            size: attachment.file.size,
          })
        ),
      };

      console.log(
        "Send payload:",
        payload
      );

      const response = await fetch(
        `${API_URL}/emails/send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Failed to send email."
        );
      }

      setSuccess(
        "Email campaign created successfully."
      );
    } catch (err) {
      console.error(
        "Send email error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * --------------------------------------------------
   * SEND LATER
   * --------------------------------------------------
   */

  const getTodayDate = () => {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
  };

  async function handleSendLater() {
    setError("");
    setSuccess("");

    if (recipients.length === 0) {
      setError("Please add at least one recipient.");
      return;
    }

    if (!subject.trim()) {
      setError("Please enter a subject.");
      return;
    }

    if (!body.trim()) {
      setError("Please enter a message.");
      return;
    }

    if (!sendDate || !sendTime) {
      setError(
        "Please select a date and time."
      );
      return;
    }

    const scheduledDate = new Date(
      `${sendDate}T${sendTime}`
    );

    if (
      Number.isNaN(
        scheduledDate.getTime()
      )
    ) {
      setError(
        "Please select a valid date and time."
      );
      return;
    }

    if (
      scheduledDate.getTime() <=
      Date.now()
    ) {
      setError(
        "Scheduled time must be in the future."
      );
      return;
    }

    try {
      setLoading(true);

      const token =
        localStorage.getItem("token");

      if (!token) {
        throw new Error(
          "Authentication required. Please login again."
        );
      }

      const payload = {
        fromEmail,
        recipients,
        subject: subject.trim(),
        body,
        scheduledAt:
          scheduledDate.toISOString(),
        delayBetweenEmails:
          Number(delay) || 0,
        hourlyLimit:
          Number(hourlyLimit) || 0,
        attachments: attachments.map(
          (attachment) => ({
            name: attachment.file.name,
            type: attachment.file.type,
            size: attachment.file.size,
          })
        ),
      };

      console.log(
        "Schedule payload:",
        payload
      );

      const response = await fetch(
        `${API_URL}/emails/schedule`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Failed to schedule email."
        );
      }

      setSuccess(
        "Email campaign scheduled successfully."
      );

      setShowSendLater(false);
    } catch (err) {
      console.error(
        "Schedule email error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * --------------------------------------------------
   * RENDER
   * --------------------------------------------------
   */

  return (
    <div className="compose-page">

      {/* =========================
          TOP BAR
      ========================= */}

      <div className="compose-topbar">

        <button
          type="button"
          className="compose-back"
          onClick={onClose}
          disabled={loading}
        >
          <ArrowLeft size={14} />
          <span>Compose New Email</span>
        </button>

        <div className="compose-top-actions">

          <button
            type="button"
            className="compose-icon-button"
            title="Attach files"
            onClick={() =>
              attachmentInputRef.current?.click()
            }
          >
            <Paperclip size={15} />
          </button>

          <button
            type="button"
            className="compose-icon-button"
            title="Schedule"
            onClick={() =>
              setShowSendLater(
                (current) => !current
              )
            }
          >
            <Clock3 size={15} />
          </button>

          <button
            type="button"
            className="compose-send-button"
            onClick={handleSend}
            disabled={loading}
          >
            {loading ? (
              <Loader2
                size={13}
                className="compose-spinner"
              />
            ) : (
              <Send size={13} />
            )}

            <span>
              {loading
                ? "Sending"
                : "Send"}
            </span>
          </button>

        </div>
      </div>

      {/* =========================
          CONTENT
      ========================= */}

      <main className="compose-content">

        <div className="compose-form">

          {/* FROM */}

          <div className="compose-field-row">

            <div className="compose-field-label">
              From
            </div>

            <div className="compose-field-control">

              <div className="from-select">
                <select
                  value={fromEmail}
                  onChange={(event) =>
                    setFromEmail(event.target.value)
                  }
                  disabled={loading || senders.length === 0}
                >
                  {senders.length === 0 ? (
                    <option value="">
                      No senders available
                    </option>
                  ) : (
                    senders.map((sender) => (
                      <option key={sender.id} value={sender.email}>
                        {sender.displayName
                          ? `${sender.displayName} <${sender.email}>`
                          : sender.email}
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown size={12} />
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

                  {recipients.map(
                    (email) => (
                      <span
                        className="recipient-chip"
                        key={email}
                      >
                        {email}

                        <button
                          type="button"
                          onClick={() =>
                            removeRecipient(
                              email
                            )
                          }
                        >
                          <X size={10} />
                        </button>
                      </span>
                    )
                  )}

                  <input
                    type="text"
                    value={recipientInput}
                    placeholder={
                      recipients.length === 0
                        ? "recipient@example.com"
                        : "Add recipient"
                    }
                    onChange={(event) =>
                      setRecipientInput(
                        event.target.value
                      )
                    }
                    onKeyDown={
                      handleRecipientKeyDown
                    }
                    onBlur={() => {
                      if (
                        recipientInput.trim()
                      ) {
                        addRecipient(
                          recipientInput
                        );
                      }
                    }}
                    disabled={loading}
                  />

                </div>

                {csvCount > 0 && (
                  <span className="csv-count">
                    {csvCount} email{csvCount === 1 ? "" : "s"} detected
                  </span>
                )}
                <button
                  type="button"
                  className="upload-list-button"
                  onClick={() =>
                    csvInputRef.current?.click()
                  }
                >
                  <Upload size={12} />
                  Upload List
                </button>

                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={
                    handleCsvUpload
                  }
                />

              </div>

            </div>
          </div>

          {/* SUBJECT */}

          <div className="compose-field-row">

            <div className="compose-field-label">
              Subject
            </div>

            <div className="compose-field-control">

              <input
                className="compose-input"
                type="text"
                placeholder="Subject"
                value={subject}
                onChange={(event) =>
                  setSubject(
                    event.target.value
                  )
                }
                disabled={loading}
              />

            </div>
          </div>

          {/* SETTINGS */}

          <div className="compose-field-row">

            <div className="compose-field-label">
              Settings
            </div>

            <div className="compose-settings">

              <label className="setting-item">
                <span>
                  Delay between 2 emails
                </span>

                <input
                  type="number"
                  min="0"
                  value={delay}
                  onChange={(event) =>
                    setDelay(
                      event.target.value
                    )
                  }
                  disabled={loading}
                />
              </label>

              <label className="setting-item">
                <span>
                  Hourly Limit
                </span>

                <input
                  type="number"
                  min="0"
                  value={hourlyLimit}
                  onChange={(event) =>
                    setHourlyLimit(
                      event.target.value
                    )
                  }
                  disabled={loading}
                />
              </label>

            </div>
          </div>

          {/* MESSAGE */}

          <div className="compose-message">

            <div
              ref={editorRef}
              className="compose-editor"
              contentEditable={!loading}
              suppressContentEditableWarning
              spellCheck={true}
              dir="ltr"
              onInput={(event) => {
                setBody(event.currentTarget.innerHTML);
              }}
              data-placeholder="Type Your Reply..."
            ></div>

            {/* TOOLBAR */}

            <div className="editor-toolbar">

              <button
                type="button"
                onClick={() =>
                  executeCommand("undo")
                }
              >
                ↶
              </button>

              <button
                type="button"
                onClick={() =>
                  executeCommand("redo")
                }
              >
                ↷
              </button>

              <span className="toolbar-divider" />

              <button
                type="button"
                onClick={() =>
                  executeCommand("bold")
                }
              >
                <Bold size={13} />
              </button>

              <button
                type="button"
                onClick={() =>
                  executeCommand("italic")
                }
              >
                <Italic size={13} />
              </button>

              <button
                type="button"
                onClick={() =>
                  executeCommand("underline")
                }
              >
                <Underline size={13} />
              </button>

              <span className="toolbar-divider" />

              <button
                type="button"
                onClick={() =>
                  executeCommand(
                    "justifyLeft"
                  )
                }
              >
                <AlignLeft size={13} />
              </button>

              <button
                type="button"
                onClick={() =>
                  executeCommand(
                    "justifyCenter"
                  )
                }
              >
                <AlignCenter size={13} />
              </button>

              <button
                type="button"
                onClick={() =>
                  executeCommand(
                    "justifyRight"
                  )
                }
              >
                <AlignRight size={13} />
              </button>

              <span className="toolbar-divider" />

              <button
                type="button"
                onClick={() =>
                  executeCommand(
                    "insertUnorderedList"
                  )
                }
              >
                <List size={13} />
              </button>

              <button
                type="button"
                onClick={() =>
                  executeCommand(
                    "insertOrderedList"
                  )
                }
              >
                <ListOrdered size={13} />
              </button>

              <button
                type="button"
                onClick={() =>
                  executeCommand(
                    "createLink"
                  )
                }
              >
                <Link size={13} />
              </button>

              <button
                type="button"
                onClick={() =>
                  attachmentInputRef.current?.click()
                }
              >
                <ImageIcon size={13} />
              </button>

            </div>
          </div>

          {/* ATTACHMENTS */}

          {attachments.length > 0 && (
            <div className="attachments-section">

              <div className="attachments-title">
                Attachments
              </div>

              <div className="attachments-list">

                {attachments.map(
                  (attachment) => (
                    <div
                      className="attachment-item"
                      key={attachment.id}
                    >
                      <Paperclip size={13} />

                      <span>
                        {attachment.file.name}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          removeAttachment(
                            attachment.id
                          )
                        }
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )
                )}

              </div>
            </div>
          )}

          <input
            ref={attachmentInputRef}
            type="file"
            multiple
            hidden
            onChange={
              handleAttachmentUpload
            }
          />

          {/* STATUS */}

          {error && (
            <div className="compose-message-error">
              {error}
            </div>
          )}

          {success && (
            <div className="compose-message-success">
              <Check size={14} />
              {success}
            </div>
          )}

        </div>

        {/* =========================
            SEND LATER POPOVER
        ========================= */}

        {showSendLater && (
          <div className="send-later-panel">

            <div className="send-later-header">
              <div>
                <strong>
                  Send Later
                </strong>

                <span>
                  Choose when to send
                </span>
              </div>

              <Clock3 size={15} />
            </div>

            <div className="send-later-field">

              <label>
                Pick date & time
              </label>

              <div className="datetime-row">

                <div className="date-input">
                  <CalendarDays size={12} />

                  <input
                    type="date"
                    value={sendDate}
                    min={getTodayDate()}
                    onChange={(event) =>
                      setSendDate(event.target.value)
                    }
                    disabled={loading}
                  />
                </div>

                <input
                  type="time"
                  value={sendTime}
                  onChange={(event) =>
                    setSendTime(
                      event.target.value
                    )
                  }
                />

              </div>

            </div>

            {/* QUICK TIMES */}

            <div className="quick-times">

              <button
                type="button"
                onClick={() => {
                  const tomorrow =
                    new Date();

                  tomorrow.setDate(
                    tomorrow.getDate() + 1
                  );

                  setSendDate(
                    tomorrow
                      .toISOString()
                      .split("T")[0]
                  );

                  setSendTime("09:00");
                }}
              >
                Tomorrow, 9:00 AM
              </button>

              <button
                type="button"
                onClick={() => {
                  const tomorrow =
                    new Date();

                  tomorrow.setDate(
                    tomorrow.getDate() + 1
                  );

                  setSendDate(
                    tomorrow
                      .toISOString()
                      .split("T")[0]
                  );

                  setSendTime("11:00");
                }}
              >
                Tomorrow, 11:00 AM
              </button>

              <button
                type="button"
                onClick={() => {
                  const tomorrow =
                    new Date();

                  tomorrow.setDate(
                    tomorrow.getDate() + 1
                  );

                  setSendDate(
                    tomorrow
                      .toISOString()
                      .split("T")[0]
                  );

                  setSendTime("15:00");
                }}
              >
                Tomorrow, 3:00 PM
              </button>

            </div>

            <div className="send-later-footer">

              <button
                type="button"
                className="send-later-cancel"
                onClick={() =>
                  setShowSendLater(false)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="send-later-done"
                onClick={handleSendLater}
                disabled={loading}
              >
                {loading ? (
                  <Loader2
                    size={12}
                    className="compose-spinner"
                  />
                ) : (
                  <Check size={12} />
                )}

                Done
              </button>

            </div>

          </div>
        )}

      </main>
    </div>
  );
}

export default Compose;