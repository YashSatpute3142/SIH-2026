import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useZonesById,
  useNodesById,
  useRisksByNodeId,
  useMapDataLoading,
  useMapDataError,
  useMapDataActions,
} from "../store/mapDataStore.js";
import { computeZoneWorstRisk } from "../utils/riskLevels.js";
import RiskBadge from "../components/shared/RiskBadge.jsx";

// Read-only per CHAT8_PLAN_V2 — zone creation/editing is out of scope for
// this chat. Adding a node to a zone (via the Nodes page form) already
// makes it appear here automatically, no code change needed per node.
function useZoneSummaries(zonesById, nodesById, risksByNodeId) {
  return useMemo(() => {
    return Object.values(zonesById)
      .map((zone) => {
        const nodes = Object.values(nodesById).filter((n) => n.zone_id === zone.id);
        const realCount = nodes.filter((n) => n.data_source === "real").length;
        const worstRisk = computeZoneWorstRisk(zone.id, nodesById, risksByNodeId);
        return {
          zone,
          nodeCount: nodes.length,
          realCount,
          simulatedCount: nodes.length - realCount,
          worstRisk,
        };
      })
      .sort((a, b) => a.zone.name.localeCompare(b.zone.name));
  }, [zonesById, nodesById, risksByNodeId]);
}

function ZoneCard({ summary }) {
  const { zone, nodeCount, realCount, simulatedCount, worstRisk } = summary;

  return (
    <Link
      to={`/dashboard/zones/${zone.zone_code}`}
      className="block bg-white dark:bg-navy-850 border border-slate-200 dark:border-navy-650 rounded-xl px-5 py-4 shadow-sm dark:shadow-lg dark:shadow-black/20 hover:border-accent-500/50 dark:hover:border-accent-400/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">{zone.name}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">
            {zone.zone_code}
          </p>
        </div>
        <RiskBadge riskLevel={worstRisk} size="sm" />
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span>{nodeCount} node{nodeCount === 1 ? "" : "s"}</span>
        {nodeCount > 0 && (
          <span>
            {realCount} real &middot; {simulatedCount} simulated
          </span>
        )}
      </div>
    </Link>
  );
}

function ZonesPage() {
  const zonesById = useZonesById();
  const nodesById = useNodesById();
  const risksByNodeId = useRisksByNodeId();
  const isLoading = useMapDataLoading();
  const error = useMapDataError();
  const { startPolling, stopPolling } = useMapDataActions();
  const [query, setQuery] = useState("");

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const summaries = useZoneSummaries(zonesById, nodesById, risksByNodeId);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter(
      (s) => s.zone.name.toLowerCase().includes(q) || s.zone.zone_code.toLowerCase().includes(q)
    );
  }, [summaries, query]);

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-navy-975 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            Zones
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {Object.keys(zonesById).length} zone{Object.keys(zonesById).length === 1 ? "" : "s"}{" "}
            &middot; worst risk among each zone's nodes
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span>Data unavailable: {error}</span>
          </div>
        )}

        <div className="mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by zone name or code..."
            className="w-full max-w-sm bg-white dark:bg-navy-850 border border-slate-200 dark:border-navy-650 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </div>

        {isLoading && Object.keys(zonesById).length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
            Loading zones...
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
            No zones match your search.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((summary) => (
              <ZoneCard key={summary.zone.id} summary={summary} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ZonesPage;
