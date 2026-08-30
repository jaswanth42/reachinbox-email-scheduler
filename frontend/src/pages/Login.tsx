import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();

    if (loading) return;

    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Login failed");
        return;
      }

      // Save authentication data
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Go to dashboard
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Login error:", error);
      alert("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = "http://localhost:5000/api/auth/google";
  };

  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* Logo */}
        <div className="auth-logo">
          <span>Reach</span>Inbox
        </div>

        {/* Heading */}
        <h1>Welcome back</h1>

        <p className="auth-subtitle">
          Sign in to manage your emails
        </p>

        {/* Email Login */}
        <form onSubmit={handleLogin}>

          <label>
            Email

            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              required
              disabled={loading}
            />
          </label>

          <label>
            Password

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              required
              disabled={loading}
            />
          </label>

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

        </form>

        {/* Divider */}
        <div className="auth-divider">
          <span>OR</span>
        </div>

        {/* Google Login */}
        <button
          type="button"
          className="google-button"
          onClick={handleGoogleLogin}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              fill="#4285F4"
              d="M21.35 12.23c0-.79-.07-1.55-.22-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42Z"
            />

            <path
              fill="#34A853"
              d="M12 21.92c2.63 0 4.84-.87 6.46-2.36l-3.14-2.45c-.87.58-1.98.92-3.32.92-2.55 0-4.71-1.72-5.49-4.04H3.27v2.53A9.76 9.76 0 0 0 12 21.92Z"
            />

            <path
              fill="#FBBC05"
              d="M6.51 13.99a5.87 5.87 0 0 1 0-3.98V7.48H3.27a9.78 9.78 0 0 0 0 9.04l3.24-2.53Z"
            />

            <path
              fill="#EA4335"
              d="M12 5.97c1.43 0 2.72.49 3.74 1.46l2.8-2.8C16.84 3.01 14.63 2.08 12 2.08a9.76 9.76 0 0 0-8.73 5.4l3.24 2.53C7.29 7.69 9.45 5.97 12 5.97Z"
            />
          </svg>

          Continue with Google
        </button>

        {/* Signup */}
        <p className="auth-footer">
          Don't have an account?{" "}
          <Link to="/signup">
            Sign up
          </Link>
        </p>

      </div>
    </div>
  );
}

export default Login;