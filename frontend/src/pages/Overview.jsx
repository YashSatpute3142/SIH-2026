import { useEffect, useMemo } from "react";
import {
  useZonesById,
  useNodesById,
  useRisksByNodeId,
  useMapDataLoading,
  useMapDataError,
  useMapDataActions,
} from "../store/mapDataStore.js";
import useMapDataStore from "../store/mapDataStore.js";
import { useTheme } from "../store/themeStore.js";
import { RISK_LEVELS, resolveRiskLevel, getRiskColor } from "../utils/riskLevels.js";
import AlertTimelineFeed from "../components/alerts/AlertTimelineFeed.jsx";

// Overview reuses the same mapDataStore LiveMap already polls — no new
// endpoint, no new hook. startPolling/stopPolling are idempotent (the store
// guards against a duplicate interval), so mounting this alongside or
// instead of LiveMapPage is safe either way.
function useNodeCounts() {
  const nodesById = useNodesById();

  return useMemo(() => {
    const nodes = Object.values(nodesById);
    const real = nodes.filter((n) => n.data_source === "real").length;
    const simulated = nodes.filter((n) => n.data_source === "simulated").length;
    const offline = nodes.filter((n) => n.status === "offline").length;
    return { total: nodes.length, real, simulated, offline };
  }, [nodesById]);
}

// Same resolveRiskLevel used by LiveMap, imported from the shared util —
// this is the same safety-sensitive resolution (missing data / offline
// always resolves to GREY, never GREEN), not a re-implementation.
function useRiskBreakdown() {
  const nodesById = useNodesById();
  const risksByNodeId = useRisksByNodeId();

  return useMemo(() => {
    const counts = { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0, GREY: 0 };
    for (const node of Object.values(nodesById)) {
      const risk = risksByNodeId[node.id];
      const level = resolveRiskLevel(node, risk);
      counts[level] = (counts[level] || 0) + 1;
    }
    return counts;
  }, [nodesById, risksByNodeId]);
}

function StatCard({ label, value, sublabel, tone = "default" }) {
  const toneClasses =
    tone === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : "text-slate-900 dark:text-slate-100";

  return (
    <div className="bg-white dark:bg-navy-850 border border-slate-200 dark:border-navy-650 rounded-xl px-5 py-4 shadow-sm dark:shadow-lg dark:shadow-black/20">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
        {label}
      </p>
      <p className={`text-2xl font-semibold tabular-nums ${toneClasses}`}>{value}</p>
      {sublabel && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sublabel}</p>
      )}
    </div>
  );
}

function StatusBanner({ isLoading, error, lastFetchedAt }) {
  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-2 mb-6">
        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
        <span>Data unavailable: {error}</span>
      </div>
    );
  }

  if (isLoading && !lastFetchedAt) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-navy-850 border border-slate-200 dark:border-navy-650 rounded-lg px-4 py-2 mb-6">
        <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-600 shrink-0" />
        <span>Loading live data...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-6">
      <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-500/80 shrink-0" />
      <span>
        Live &middot; last updated{" "}
        {lastFetchedAt ? new Date(lastFetchedAt).toLocaleTimeString() : "—"}
      </span>
    </div>
  );
}

function RiskBreakdown({ counts }) {
  const theme = useTheme();
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="bg-white dark:bg-navy-850 border border-slate-200 dark:border-navy-650 rounded-xl px-5 py-4 shadow-sm dark:shadow-lg dark:shadow-black/20">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide">
        Risk Breakdown
      </p>
      {total === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">No nodes registered yet</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {Object.entries(RISK_LEVELS).map(([key, info]) => (
            <div
              key={key}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-650"
            >
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{ backgroundColor: getRiskColor(key, theme), color: "#0f172a" }}
              >
                {info.icon}
              </span>
              <span className="text-sm text-slate-700 dark:text-slate-300">{info.label}</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {counts[key] || 0}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Overview() {
  const zonesById = useZonesById();
  const counts = useNodeCounts();
  const riskCounts = useRiskBreakdown();
  const isLoading = useMapDataLoading();
  const error = useMapDataError();
  const lastFetchedAt = useMapDataStore((state) => state.lastFetchedAt);
  const { startPolling, stopPolling } = useMapDataActions();

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const zoneCount = Object.keys(zonesById).length;

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-navy-975 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            Overview
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Mine-wide sensor network summary — decision support only.
          </p>
        </div>

        <StatusBanner isLoading={isLoading} error={error} lastFetchedAt={lastFetchedAt} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <StatCard label="Total Nodes" value={counts.total} sublabel="Across all zones" />
          <StatCard
            label="Real Sensors"
            value={counts.real}
            sublabel={`${counts.simulated} simulated`}
          />
          <StatCard label="Zones Monitored" value={zoneCount} />
          <StatCard
            label="Offline Nodes"
            value={counts.offline}
            sublabel="Shown as No Data, never Green"
            tone={counts.offline > 0 ? "warning" : "default"}
          />
        </div>

        <RiskBreakdown counts={riskCounts} />

        <div className="mt-4">
          <AlertTimelineFeed limit={5} />
        </div>
      </div>
    </div>
  );
}

export default Overview;
