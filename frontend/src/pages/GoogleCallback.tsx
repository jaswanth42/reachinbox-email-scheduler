import { useEffect } from "react";

function GoogleCallback() {
  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const token = params.get("token");
    const userParam = params.get("user");

    /*
     * Token is required.
     */
    if (!token) {
      console.error(
        "Google login: token not found"
      );

      window.location.replace(
        "/login?error=google_auth_failed"
      );

      return;
    }

    /*
     * Store JWT.
     */
    localStorage.setItem(
      "token",
      token
    );

    /*
     * Store Google user profile.
     */
    if (userParam) {
      try {
        const user = JSON.parse(
          userParam
        );

        localStorage.setItem(
          "user",
          JSON.stringify(user)
        );
      } catch (error) {
        console.error(
          "Google login: failed to parse user data",
          error
        );
      }
    }

    /*
     * Use a full page navigation so App.tsx
     * re-reads the newly stored token/user from
     * localStorage.
     */
    window.location.replace("/");
  }, []);

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

