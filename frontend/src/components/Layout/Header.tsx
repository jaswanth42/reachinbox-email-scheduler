import {
  Search,
  Bell,
  ChevronDown,
  Send,
  LogOut,
} from "lucide-react";
import { useEffect, useState } from "react";

interface HeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  onLogout: () => void;
}

function Header({ search, onSearchChange, onLogout }: HeaderProps) {
  const [showProfile, setShowProfile] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackTeam, setSlackTeam] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    fetch("http://localhost:5000/api/auth/slack/status", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => response.json())
      .then((data) => {
        setSlackConnected(Boolean(data?.connected));
        setSlackTeam(data?.teamName || null);
      })
      .catch(() => {
        setSlackConnected(false);
        setSlackTeam(null);
      });
  }, []);
  const storedUser = localStorage.getItem("user");
  let user: any = {};
    try {
      user = storedUser ? JSON.parse(storedUser) : {};
    } catch {
      user = {};
    }
    const avatarSource =
      user?.name ||
      user?.fullName ||
      user?.email ||
      "";
    const avatarLetter =
    avatarSource.trim().charAt(0).toUpperCase() || "U";

  return (
    <header className="header">
      {/* BRAND */}
      <div className="brand">
        <div className="brand-icon">
          <Send size={19} />
        </div>

        <span className="brand-name">
          Reach<span>Inbox</span>
        </span>
      </div>

      {/* HEADER RIGHT */}
      <div className="header-right">

        {/* SEARCH */}
        <div className="search-box">
          <Search size={17} />

          <input
            type="text"
            placeholder="Search emails..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />

          <span className="shortcut">
            <span>⌘</span> K
          </span>
        </div>

        {/* NOTIFICATION */}
        <button className="icon-button notification">
          <Bell size={19} />
          <span className="notification-dot" />
        </button>

        {/* PROFILE */}
        <div className="profile-wrapper">
          <button
            type="button"
            className="profile"
            onClick={() => setShowProfile(!showProfile)}
          >
            <div className="avatar">{avatarLetter}</div>
            <ChevronDown size={16} />
          </button>

          {showProfile && (
            <div className="profile-menu">
              {slackConnected ? (
                <>
                  <div style={{ padding: "8px 12px", fontSize: "12px", opacity: 0.75 }}>
                    Slack connected{slackTeam ? ` · ${slackTeam}` : ""}
                  </div>
                  <button
                    type="button"
                    className="logout-button"
                    onClick={async () => {
                      const token = localStorage.getItem("token");
                      try {
                        await fetch("http://localhost:5000/api/auth/slack/disconnect", {
                          method: "POST",
                          headers: { Authorization: `Bearer ${token}` },
                        });
                      } finally {
                        setSlackConnected(false);
                        setSlackTeam(null);
                      }
                    }}
                  >
                    <LogOut size={16} />
                    <span>Disconnect Slack</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="logout-button"
                  onClick={async () => {
                    const token = localStorage.getItem("token");
                    if (!token) return;

                    try {
                      const response = await fetch(
                        "http://localhost:5000/api/auth/slack/connect-url",
                        { headers: { Authorization: `Bearer ${token}` } }
                      );
                      const data = await response.json();
                      if (!response.ok || !data?.url) {
                        throw new Error(data?.message || "Unable to connect Slack");
                      }
                      window.location.href = data.url;
                    } catch (error) {
                      console.error("Slack connection error:", error);
                    }
                  }}
                >
                  <Send size={16} />
                  <span>Connect Slack</span>
                </button>
              )}

              <button
                type="button"
                className="logout-button"
                onClick={() => {
                  setShowProfile(false);
                  onLogout();
                }}
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}

export default Header;