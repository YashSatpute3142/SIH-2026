import { useState } from "react";
import { useApiResource } from "../hooks/useApiResource.js";
import { useSyncActions } from "../hooks/useSyncActions.js";
import { useUser } from "../store/authStore.js";

const MUTATION_ROLES = ["admin", "operator"];

function StatTile({ label, value, tone = "default" }) {
  const toneClass =
    tone === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "danger"
      ? "text-red-600 dark:text-red-400"
      : "text-slate-900 dark:text-slate-100";

  return (
    <div className="bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-650 rounded-lg px-4 py-3">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function SystemHealthPage() {
  const user = useUser();
  const canMutate = MUTATION_ROLES.includes(user?.role);
  const { data: status, isLoading, error, refetch } = useApiResource("/api/sync/status", {
    pollIntervalMs: 10000,
  });
  const { toggleInternet, triggerSync, isSubmitting, error: actionError } = useSyncActions(refetch);
  const [lastTriggerResult, setLastTriggerResult] = useState(null);

  const handleToggle = () => {
    if (!status) return;
    toggleInternet(!status.internet_online).catch(() => {});
  };

  const handleTrigger = () => {
    setLastTriggerResult(null);
    triggerSync()
      .then((result) => setLastTriggerResult(result))
      .catch(() => {});
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-navy-975 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            System Health
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Offline-first sync status. Model registry status is not yet available
            \u2014 no backend endpoint exists for it yet.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span>Sync status unavailable: {error}</span>
          </div>
        )}
        {actionError && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        <div className="bg-white dark:bg-navy-850 border border-slate-200 dark:border-navy-650 rounded-xl shadow-sm dark:shadow-lg dark:shadow-black/20 px-5 py-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  status?.internet_online
                    ? "bg-emerald-500 dark:bg-emerald-500/80"
                    : "bg-amber-500 dark:bg-amber-500/80"
                }`}
              />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {isLoading && !status
                  ? "Loading..."
                  : status?.internet_online
                  ? "Internet Online"
                  : "Internet Offline"}
              </p>
            </div>

            {canMutate && status && (
              <button
                onClick={handleToggle}
                disabled={isSubmitting}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-navy-900 border border-slate-200 dark:border-navy-650 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-800 transition-colors disabled:opacity-50"
                title="Test switch on the real network path \u2014 for demoing offline-first behavior, not a real connectivity setting"
              >
                {status.internet_online ? "Simulate Outage" : "Restore Connectivity"}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatTile label="Pending" value={status?.pending_count ?? "\u2014"} tone={status?.pending_count > 0 ? "warning" : "default"} />
            <StatTile label="Failed" value={status?.failed_count ?? "\u2014"} tone={status?.failed_count > 0 ? "danger" : "default"} />
            <StatTile label="Synced" value={status?.synced_count ?? "\u2014"} />
            <StatTile
              label="Last Synced"
              value={status?.last_synced_at ? new Date(status.last_synced_at).toLocaleTimeString() : "Never"}
            />
          </div>

          {canMutate && (
            <div className="pt-4 border-t border-slate-100 dark:border-navy-800">
              <button
                onClick={handleTrigger}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? "Syncing..." : "Trigger Sync Now"}
              </button>
              {lastTriggerResult && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  {lastTriggerResult.skipped_offline
                    ? "Skipped \u2014 currently offline"
                    : `${lastTriggerResult.synced} synced \u00b7 ${lastTriggerResult.failed_or_retrying} failed/retrying \u00b7 ${lastTriggerResult.total_processed} processed`}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SystemHealthPage;
