import { memo, useEffect, useState, useCallback } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useUser, useAuthActions } from "../../store/authStore.js";
import { useTheme, useToggleTheme, useSidebarCollapsed, useToggleSidebar } from "../../store/themeStore.js";
import { apiGet } from "../../utils/apiClient.js";

const NAV_ITEMS = [
  { label: "Overview", code: "OV", path: "/dashboard", enabled: true },
  { label: "Live Map", code: "LM", path: "/dashboard", enabled: true },
  { label: "Nodes", code: "ND", path: "/dashboard/nodes", enabled: false },
  { label: "Zones", code: "ZN", path: "/dashboard/zones", enabled: false },
  { label: "Alerts", code: "AL", path: "/dashboard/alerts", enabled: false },
  { label: "Analytics", code: "AN", path: "/dashboard/analytics", enabled: false },
  { label: "System Health", code: "SH", path: "/dashboard/system-health", enabled: false },
];

const SYNC_STATUS_POLL_MS = 20000;

const Sidebar = memo(function Sidebar() {
  const collapsed = useSidebarCollapsed();
  const toggleSidebar = useToggleSidebar();

  return (
    <aside
      className={`shrink-0 bg-white dark:bg-navy-900 border-r border-slate-200 dark:border-navy-700 flex flex-col transition-all duration-300 ease-in-out ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      <div className="px-4 py-6 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-slate-900 dark:text-slate-100 font-semibold leading-tight truncate">
              Subsidence Watch
            </p>
            <p className="text-slate-500 dark:text-slate-500 text-xs mt-1">Mine Command Center</p>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "\u203A" : "\u2039"}
        </button>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) =>
          item.enabled ? (
            <NavLink
              key={item.label}
              to={item.path}
              end
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-slate-100 dark:bg-navy-700 text-slate-900 dark:text-slate-100"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 hover:text-slate-800 dark:hover:text-slate-200"
                }`
              }
            >
              {collapsed ? (
                <span className="text-xs font-semibold">{item.code}</span>
              ) : (
                <span>{item.label}</span>
              )}
            </NavLink>
          ) : (
            <div
              key={item.label}
              title={collapsed ? item.label : undefined}
              className="px-3 py-2 rounded-lg text-sm text-slate-300 dark:text-slate-600 cursor-not-allowed flex items-center justify-between"
            >
              {collapsed ? (
                <span className="text-xs font-semibold">{item.code}</span>
              ) : (
                <>
                  <span>{item.label}</span>
                  <span className="text-[10px] text-slate-300 dark:text-slate-700">soon</span>
                </>
              )}
            </div>
          )
        )}
      </nav>
    </aside>
  );
});

const SyncStatusBadge = memo(function SyncStatusBadge() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await apiGet("/api/sync/status");
        if (!cancelled) {
          setStatus(data);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    poll();
    const timer = setInterval(poll, SYNC_STATUS_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (error || !status) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
        <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-600" />
        <span className="text-xs text-slate-500 dark:text-slate-500">Sync status unavailable</span>
      </div>
    );
  }

  const isOnline = status.internet_online;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
      <span
        className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500 dark:bg-emerald-400" : "bg-amber-500 dark:bg-amber-400"}`}
      />
      <span className="text-xs text-slate-700 dark:text-slate-300">
        {isOnline ? "Online" : "Offline"}
      </span>
      {status.pending_count > 0 && (
        <span className="text-xs text-slate-500 dark:text-slate-500">· {status.pending_count} pending</span>
      )}
      {status.failed_count > 0 && (
        <span className="text-xs text-red-600 dark:text-red-400">· {status.failed_count} failed</span>
      )}
    </div>
  );
});

const ThemeToggle = memo(function ThemeToggle() {
  const theme = useTheme();
  const toggleTheme = useToggleTheme();

  return (
    <button
      onClick={toggleTheme}
      className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
      aria-label="Toggle theme"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? "\u2600" : "\u263D"}
    </button>
  );
});

const UserMenu = memo(function UserMenu({ onSignOut }) {
  const user = useUser();

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <p className="text-sm text-slate-800 dark:text-slate-200 leading-tight">{user.name}</p>
        <p className="text-xs text-slate-500 dark:text-slate-500 leading-tight">{user.role}</p>
      </div>
      <button
        onClick={onSignOut}
        className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 text-sm transition-colors"
      >
        Sign Out
      </button>
    </div>
  );
});

const TopBar = memo(function TopBar({ onSignOut }) {
  return (
    <header className="h-16 shrink-0 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between px-6">
      <SyncStatusBadge />
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <UserMenu onSignOut={onSignOut} />
      </div>
    </header>
  );
});

function CommandCenterShell({ children }) {
  const { clearSession } = useAuthActions();
  const navigate = useNavigate();

  const handleSignOut = useCallback(() => {
    clearSession();
    navigate("/");
  }, [clearSession, navigate]);

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-navy-950">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onSignOut={handleSignOut} />
        <main className="flex-1 min-h-0">{children}</main>
      </div>
    </div>
  );
}

export default CommandCenterShell;
