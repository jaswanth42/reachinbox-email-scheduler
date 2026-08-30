import {
  Inbox,
  CalendarDays,
  Send,
  TriangleAlert,
  Plus,
} from "lucide-react";

import { useNavigate, useLocation } from "react-router-dom";

interface SidebarProps {
  onCompose: () => void;
}

function Sidebar({ onCompose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  let activeTab = "All";

  if (location.pathname === "/scheduled") {
    activeTab = "Scheduled";
  } else if (location.pathname === "/sent") {
    activeTab = "Sent";
  } else if (location.pathname === "/failed") {
    activeTab = "Failed";
  }

  return (
    <aside className="sidebar">

      

      <nav className="nav">

        <button
          className={`nav-item ${
            activeTab === "All" ? "active" : ""
          }`}
          onClick={() => navigate("/")}
        >
          <Inbox size={18} />
          <span>All</span>
        </button>

        <button
          className={`nav-item ${
            activeTab === "Scheduled" ? "active" : ""
          }`}
          onClick={() => navigate("/scheduled")}
        >
          <CalendarDays size={18} />
          <span>Scheduled</span>
        </button>

        <button
          className={`nav-item ${
            activeTab === "Sent" ? "active" : ""
          }`}
          onClick={() => navigate("/sent")}
        >
          <Send size={18} />
          <span>Sent</span>
        </button>

        <button
          className={`nav-item ${
            activeTab === "Failed" ? "active" : ""
          }`}
          onClick={() => navigate("/failed")}
        >
          <TriangleAlert size={18} />
          <span>Failed</span>
        </button>

      </nav>

      <div className="sidebar-divider" />

      <button
        className="compose-button"
        onClick={onCompose}
      >
        <Plus size={18} />
        Compose
      </button>

    </aside>
  );
}

export default Sidebar;