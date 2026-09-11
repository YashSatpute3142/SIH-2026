import { Link } from "react-router-dom";
import { useAlerts } from "../../hooks/useAlerts.js";
import { normalizeAlert, AlertStatusBadge, AlertSeverityBadge, relativeTime } from "./alertHelpers.jsx";

// Compact chronological feed for Overview — distinct from the full Alerts
// table (AlertsPage), reusing the same useAlerts hook with a small limit
// rather than separate data logic, per CHAT8_PLAN_V2 A6.
function AlertTimelineFeed({ limit = 5 }) {
  const { data, isLoading, error } = useAlerts({ limit }, { pollIntervalMs: 15000 });
  const alerts = (data || []).map(normalizeAlert);

  return (
    <div className="bg-white dark:bg-navy-850 border border-slate-200 dark:border-navy-650 rounded-xl shadow-sm dark:shadow-lg dark:shadow-black/20 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-navy-650">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Recent Alerts</p>
        <Link
          to="/dashboard/alerts"
          className="text-xs text-accent-600 dark:text-accent-400 hover:underline"
        >
          View all
        </Link>
      </div>

      {error ? (
        <div className="px-5 py-6 text-center text-sm text-red-500 dark:text-red-400">
          Alerts unavailable: {error}
        </div>
      ) : isLoading && alerts.length === 0 ? (
        <div className="px-5 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
          Loading alerts...
        </div>
      ) : alerts.length === 0 ? (
        <div className="px-5 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
          No alerts yet.
        </div>
      ) : (
        <ul>
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className="px-5 py-3 border-b border-slate-100 dark:border-navy-800 last:border-0 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <AlertSeverityBadge alertLevel={alert.alertLevel} />
                  {alert.affectedNodes.length > 0 && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                      {alert.affectedNodes.slice(0, 2).join(", ")}
                      {alert.affectedNodes.length > 2 ? ` +${alert.affectedNodes.length - 2}` : ""}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                  {alert.title}
                </p>
              </div>
              <div className="text-right shrink-0">
                <AlertStatusBadge status={alert.status} />
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {relativeTime(alert.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default AlertTimelineFeed;
