import { useState, useMemo } from "react";
import { useAlerts } from "../hooks/useAlerts.js";
import { useAlertActions } from "../hooks/useAlertActions.js";
import { useZonesById } from "../store/mapDataStore.js";
import { normalizeAlert, AlertStatusBadge, AlertSeverityBadge, relativeTime } from "../components/alerts/alertHelpers.jsx";

// Status values confirmed against AlertStatus: active | acknowledged |
// resolved (an earlier version of this page used "open", which the backend
// does not recognize — list_alerts's status filter lowercases and matches
// against the real column values, so "open" would have silently returned
// zero rows every time).
const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "resolved", label: "Resolved" },
];

function AlertActions({ alert, onAcknowledge, onResolve, isSubmitting }) {
  if (alert.status === "resolved") {
    return <span className="text-xs text-slate-400 dark:text-slate-600">&mdash;</span>;
  }

  return (
    <div className="flex items-center justify-end gap-3">
      {alert.status === "active" && (
        <button
          onClick={() => onAcknowledge(alert.id)}
          disabled={isSubmitting}
          className="text-xs font-medium text-accent-600 dark:text-accent-400 hover:underline disabled:opacity-50"
        >
          Acknowledge
        </button>
      )}
      <button
        onClick={() => onResolve(alert.id)}
        disabled={isSubmitting}
        className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-50"
      >
        Resolve
      </button>
    </div>
  );
}

function AlertsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const zonesById = useZonesById();
  const params = useMemo(
    () => (statusFilter ? { status: statusFilter, limit: 200 } : { limit: 200 }),
    [statusFilter]
  );
  const { data, isLoading, error, refetch } = useAlerts(params, { pollIntervalMs: 15000 });
  const { acknowledge, resolve, isSubmitting, error: actionError } = useAlertActions(refetch);

  const alerts = useMemo(() => (data || []).map(normalizeAlert), [data]);

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-navy-975 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            Alerts
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            System-generated &middot; acknowledge and resolve as conditions change
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span>Data unavailable: {error}</span>
          </div>
        )}
        {actionError && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        <div className="flex gap-2 mb-4">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-accent-500 text-white"
                  : "bg-white dark:bg-navy-850 border border-slate-200 dark:border-navy-650 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="bg-white dark:bg-navy-850 border border-slate-200 dark:border-navy-650 rounded-xl shadow-sm dark:shadow-lg dark:shadow-black/20 overflow-hidden">
          {isLoading && alerts.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
              Loading alerts...
            </div>
          ) : alerts.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
              No alerts match this filter.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-navy-650 text-left">
                  <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">
                    Level
                  </th>
                  <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">
                    Zone
                  </th>
                  <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">
                    Affected Nodes
                  </th>
                  <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">
                    Alert
                  </th>
                  <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">
                    Status
                  </th>
                  <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">
                    Created
                  </th>
                  <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr
                    key={alert.id}
                    className="border-b border-slate-100 dark:border-navy-800 last:border-0 hover:bg-slate-50 dark:hover:bg-navy-900/60 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <AlertSeverityBadge alertLevel={alert.alertLevel} />
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                      {zonesById[alert.zoneId]?.name || `Zone ${alert.zoneId}`}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400 text-xs font-mono">
                      {alert.affectedNodes.length > 0 ? alert.affectedNodes.join(", ") : "\u2014"}
                    </td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                      <p>{alert.title}</p>
                      {alert.message && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          {alert.message}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <AlertStatusBadge status={alert.status} />
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-500 text-xs">
                      {relativeTime(alert.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <AlertActions
                        alert={alert}
                        onAcknowledge={acknowledge}
                        onResolve={resolve}
                        isSubmitting={isSubmitting}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default AlertsPage;
