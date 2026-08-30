import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function GoogleCallback() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");

    if (!token) {
      console.error("Google login: token not found");
      navigate("/login", { replace: true });
      return;
    }

    localStorage.setItem("token", token);

    // Go to dashboard
    navigate("/", { replace: true });
  }, [location.search, navigate]);

  return (
    <div className="auth-page">
      <div className="auth-card google-loading">
        <div className="auth-logo">
          <span>Reach</span>Inbox
        </div>

        <div className="loading-spinner"></div>

        <h1>Signing you in...</h1>

        <p className="auth-subtitle">
          Please wait while we complete your Google login.
        </p>
      </div>
    </div>
  );
}

export default GoogleCallback;