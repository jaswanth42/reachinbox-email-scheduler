import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function SlackCallback() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const success = params.get("success") === "true";

    if (success) {
      window.setTimeout(() => navigate("/", { replace: true }), 1200);
    } else {
      window.setTimeout(() => navigate("/", { replace: true }), 1800);
    }
  }, [location.search, navigate]);

  const success = new URLSearchParams(location.search).get("success") === "true";

  return (
    <div className="auth-page">
      <div className="auth-card google-loading">
        <div className="auth-logo"><span>Reach</span>Inbox</div>
        <h1>{success ? "Slack connected" : "Slack connection failed"}</h1>
        <p className="auth-subtitle">
          {success
            ? "Your Slack connection is ready for rate-limit notifications."
            : "We could not connect Slack. Please try again from the profile menu."}
        </p>
      </div>
    </div>
  );
}

export default SlackCallback;
