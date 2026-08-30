import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Scheduled from "./pages/Scheduled";
import Failed from "./pages/Failed";
import Sent from "./pages/Sent";
import AllEmails from "./pages/AllEmails";
import GoogleCallback from "./pages/GoogleCallback";
import SlackCallback from "./pages/SlackCallback";
import Compose from "./components/Compose/Compose";

import "./App.css";

function App() {
  const [token, setToken] = useState(
    localStorage.getItem("token")
  );

  const [senders, setSenders] = useState<
    Array<{
      id: string;
      email: string;
      displayName?: string | null;
    }>
  >([]);

  useEffect(() => {
    if (!token) {
      setSenders([]);
      return;
    }

    const loadSenders = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/auth/senders",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Failed to load senders");
        }

        setSenders(Array.isArray(data?.senders) ? data.senders : []);
      } catch (error) {
        console.error("Load senders error:", error);
        setSenders([]);
      }
    };

    loadSenders();
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setToken(null);
  };

  return (
    <BrowserRouter>
      <Routes>

        {/* LOGIN */}
        <Route
          path="/login"
          element={
            token ? (
              <Navigate to="/" replace />
            ) : (
              <Login />
            )
          }
        />

        {/* SIGNUP */}
        <Route
          path="/signup"
          element={
            token ? (
              <Navigate to="/" replace />
            ) : (
              <Signup />
            )
          }
        />

        {/* GOOGLE CALLBACK */}
        <Route
          path="/auth/callback"
          element={<GoogleCallback />}
        />

        <Route
          path="/slack/callback"
          element={<SlackCallback />}
        />

        {/* DASHBOARD */}
        <Route
          path="/"
          element={
            token ? <Dashboard onLogout={handleLogout} /> : <Navigate to="/login" replace />
          }
        >
          <Route index element={<AllEmails />} />
          <Route path="sent" element={<Sent />} />
          <Route path="failed" element={<Failed />} />
          <Route path="scheduled" element={<Scheduled />} />
        </Route>

        {/* COMPOSE */}
        <Route
          path="/compose"
          element={
            <Compose
              onClose={() => window.history.back()}
              senders={senders}
            />
          }
        />

        {/* UNKNOWN */}
        <Route
          path="*"
          element={
            <Navigate
              to={token ? "/" : "/login"}
              replace
            />
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;