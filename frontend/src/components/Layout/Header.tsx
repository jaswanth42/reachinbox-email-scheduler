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

interface User {
  id?: string;
  name?: string;
  fullName?: string;
  email?: string;
  avatar_url?: string | null;
  avatarUrl?: string | null;
}

function Header({
  search,
  onSearchChange,
  onLogout,
}: HeaderProps) {
  const [showProfile, setShowProfile] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackTeam, setSlackTeam] = useState<string | null>(null);

  const [user, setUser] = useState<User>({});

  useEffect(() => {
    /*
     * Load logged-in user from localStorage.
     */
    const storedUser = localStorage.getItem("user");

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (error) {
        console.error(
          "Failed to parse stored user:",
          error
        );
        setUser({});
      }
    }

    /*
     * Load Slack connection status.
     */
    const token = localStorage.getItem("token");

    if (!token) {
      return;
    }

    fetch(
      "http://localhost:5000/api/auth/slack/status",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.message ||
              "Failed to fetch Slack status"
          );
        }

        return data;
      })
      .then((data) => {
        setSlackConnected(
          Boolean(data?.connected)
        );

        setSlackTeam(
          data?.teamName || null
        );
      })
      .catch((error) => {
        console.error(
          "Slack status error:",
          error
        );

        setSlackConnected(false);
        setSlackTeam(null);
      });
  }, []);

  /*
   * User display values.
   */
  const displayName =
    user?.name ||
    user?.fullName ||
    "User";

  const displayEmail =
    user?.email ||
    "";

  const avatarUrl =
    user?.avatar_url ||
    user?.avatarUrl ||
    null;

  const avatarSource =
    displayName ||
    displayEmail ||
    "User";

  const avatarLetter =
    avatarSource
      .trim()
      .charAt(0)
      .toUpperCase() || "U";

  /*
   * Connect Slack.
   */
  const handleConnectSlack =
    async () => {
      const token =
        localStorage.getItem("token");

      if (!token) {
        return;
      }

      try {
        const response =
          await fetch(
            "http://localhost:5000/api/auth/slack/connect-url",
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data?.url
        ) {
          throw new Error(
            data?.message ||
              "Unable to connect Slack"
          );
        }

        window.location.href =
          data.url;
      } catch (error) {
        console.error(
          "Slack connection error:",
          error
        );
      }
    };

  /*
   * Disconnect Slack.
   */
  const handleDisconnectSlack =
    async () => {
      const token =
        localStorage.getItem("token");

      try {
        if (token) {
          await fetch(
            "http://localhost:5000/api/auth/slack/disconnect",
            {
              method: "POST",
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );
        }
      } catch (error) {
        console.error(
          "Slack disconnect error:",
          error
        );
      } finally {
        setSlackConnected(false);
        setSlackTeam(null);
      }
    };

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
            onChange={(event) =>
              onSearchChange(
                event.target.value
              )
            }
          />

          <span className="shortcut">
            <span>⌘</span> K
          </span>
        </div>

        {/* NOTIFICATION */}
        <button
          type="button"
          className="icon-button notification"
          aria-label="Notifications"
        >
          <Bell size={19} />

          <span className="notification-dot" />
        </button>

        {/* PROFILE */}
        <div className="profile-wrapper">
          <button
            type="button"
            className="profile"
            onClick={() =>
              setShowProfile(
                (previous) =>
                  !previous
              )
            }
            aria-expanded={showProfile}
            aria-label="Open profile menu"
          >
            {/* AVATAR */}
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`${displayName} avatar`}
                className="avatar avatar-image"
              />
            ) : (
              <div className="avatar">
                {avatarLetter}
              </div>
            )}

            {/* USER INFO */}
            <div className="profile-user-info">
              {/* <span className="profile-name">
                {displayName}
              </span> */}

              {displayEmail && (
                <span className="profile-email">
                  {displayEmail}
                </span>
              )}
            </div>

            <ChevronDown size={16} />
          </button>

          {/* PROFILE MENU */}
          {showProfile && (
            <div className="profile-menu">
              {/* USER SUMMARY */}
              <div className="profile-menu-user">
                <div className="profile-menu-avatar">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={`${displayName} avatar`}
                      className="avatar avatar-image"
                    />
                  ) : (
                    <div className="avatar">
                      {avatarLetter}
                    </div>
                  )}
                </div>

                <div className="profile-menu-info">
                  <strong>
                    {displayName}
                  </strong>

                  {/* {displayEmail && (
                    <span>
                      {displayEmail}
                    </span>
                  )} */}
                </div>
              </div>

              <div className="profile-menu-divider" />

              {/* SLACK */}
              {slackConnected ? (
                <>
                  <div
                    style={{
                      padding:
                        "8px 12px",
                      fontSize:
                        "12px",
                      opacity: 0.75,
                    }}
                  >
                    Slack connected
                    {slackTeam
                      ? ` · ${slackTeam}`
                      : ""}
                  </div>

                  <button
                    type="button"
                    className="logout-button"
                    onClick={
                      handleDisconnectSlack
                    }
                  >
                    <Send size={16} />

                    <span>
                      Disconnect Slack
                    </span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="logout-button"
                  onClick={
                    handleConnectSlack
                  }
                >
                  <Send size={16} />

                  <span>
                    Connect Slack
                  </span>
                </button>
              )}

              {/* LOGOUT */}
              <button
                type="button"
                className="logout-button"
                onClick={() => {
                  setShowProfile(false);
                  onLogout();
                }}
              >
                <LogOut size={16} />

                <span>
                  Logout
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
