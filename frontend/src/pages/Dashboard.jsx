import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, clearToken } from "../utils/auth.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function Dashboard() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Session invalid");
        return res.json();
      })
      .then(setUser)
      .catch(() => navigate("/login", { replace: true }));
  }, [navigate]);

  function handleSignOut() {
    clearToken();
    navigate("/");
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-950">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Mine Subsidence Command Center</h1>
        <button
          onClick={handleSignOut}
          className="px-4 py-2 rounded-lg bg-navy-800 hover:bg-navy-700 transition-colors"
        >
          Sign Out
        </button>
      </div>

      <div className="bg-navy-900 rounded-xl p-6 border border-navy-700">
        <p className="text-slate-400 text-sm mb-1">Signed in as</p>
        <p className="text-lg font-semibold">{user.name}</p>
        <p className="text-slate-400">{user.email}</p>
        <p className="text-slate-500 text-sm mt-2">Role: {user.role}</p>
      </div>
    </div>
  );
}

export default Dashboard;
