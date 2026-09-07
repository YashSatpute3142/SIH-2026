import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser, useIsAuthInitialized, useAuthActions } from "../store/authStore.js";
import CommandCenterShell from "../components/layout/CommandCenterShell.jsx";
import LiveMap from "../components/map/LiveMap.jsx";

function Dashboard() {
  const user = useUser();
  const isInitialized = useIsAuthInitialized();
  const { fetchCurrentUser } = useAuthActions();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  useEffect(() => {
    if (isInitialized && !user) {
      navigate("/login", { replace: true });
    }
  }, [isInitialized, user, navigate]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-navy-950">
        <p className="text-slate-500 dark:text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <CommandCenterShell>
      <LiveMap />
    </CommandCenterShell>
  );
}

export default Dashboard;
