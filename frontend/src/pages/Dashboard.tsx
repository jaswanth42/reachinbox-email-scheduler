import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Header from "../components/Layout/Header";
import Sidebar from "../components/Layout/Sidebar";

interface DashboardProps {
  onLogout: () => void;
}

function Dashboard({ onLogout }: DashboardProps) {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  return (
    <div className="app">
      <div className="dashboard">
        <Header
          search={search}
          onSearchChange={setSearch}
          onLogout={onLogout}
        />

        <div className="main">
          <Sidebar onCompose={() => navigate("/compose")} />

          <main className="content">
            <Outlet
              context={{
                search,
              }}
            />
          </main>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;