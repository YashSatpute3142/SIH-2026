import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { isAuthenticated } from "../../utils/auth.js";
import { useUser, useIsAuthInitialized, useAuthActions } from "../../store/authStore.js";

function ProtectedRoute() {
  const user = useUser();
  const isInitialized = useIsAuthInitialized();
  const { fetchCurrentUser } = useAuthActions();

  // Fast-path: no token at all, don't bother fetching.
  const hasToken = isAuthenticated();

  useEffect(() => {
    if (hasToken) {
      fetchCurrentUser();
    }
  }, [hasToken, fetchCurrentUser]);

  if (!hasToken) {
    return <Navigate to="/login" replace />;
  }

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-navy-950">
        <p className="text-slate-500 dark:text-slate-400">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
