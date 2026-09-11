import { useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  useZonesById,
  useNodesById,
  useRisksByNodeId,
  useMapDataActions,
} from "../store/mapDataStore.js";
import { computeZoneWorstRisk, resolveRiskLevel } from "../utils/riskLevels.js";
import RiskBadge from "../components/shared/RiskBadge.jsx";
import LiveMap from "../components/map/LiveMap.jsx";

// No GET /api/zones/{zone_code} endpoint exists yet (only list_zones) — per
// the Chat 8 handover's known gap, this filters the already-fetched zone
// list client-side by zone_code rather than issuing a new request.
function useZoneByCode(zonesById, zoneCode) {
  return useMemo(
    () => Object.values(zonesById).find((z) => z.zone_code === zoneCode) || null,
    [zonesById, zoneCode]
  );
}

function ZoneDetailsPage() {
  const { zoneCode } = useParams();
  const zonesById = useZonesById();
  const nodesById = useNodesById();
  const risksByNodeId = useRisksByNodeId();
  const { startPolling, stopPolling } = useMapDataActions();

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const zone = useZoneByCode(zonesById, zoneCode);

  const zoneNodes = useMemo(() => {
    if (!zone) return [];
    return Object.values(nodesById)
      .filter((n) => n.zone_id === zone.id)
      .map((node) => ({ node, riskLevel: resolveRiskLevel(node, risksByNodeId[node.id]) }))
      .sort((a, b) => a.node.node_id.localeCompare(b.node.node_id));
  }, [zone, nodesById, risksByNodeId]);

  const worstRisk = zone ? computeZoneWorstRisk(zone.id, nodesById, risksByNodeId) : "GREY";

  if (Object.keys(zonesById).length > 0 && !zone) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-navy-975">
        <div className="text-center">
          <p className="text-slate-500 dark:text-slate-400 mb-3">
            No zone found for code "{zoneCode}".
          </p>
          <Link to="/dashboard/zones" className="text-accent-600 dark:text-accent-400 text-sm">
            &larr; Back to Zones
          </Link>
        </div>
      </div>
    );
  }

  if (!zone) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-navy-975">
        <p className="text-slate-400 dark:text-slate-500 text-sm">Loading zone...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-navy-975 p-6">
      <div className="max-w-5xl mx-auto">
        <Link
          to="/dashboard/zones"
          className="text-sm text-accent-600 dark:text-accent-400 hover:underline"
        >
          &larr; Back to Zones
        </Link>

        <div className="flex items-start justify-between gap-4 mt-3 mb-6 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
              {zone.name}
            </h1>
            <p className="text-sm text-slate-400 dark:text-slate-500 font-mono mt-1">
              {zone.zone_code}
            </p>
          </div>
          <RiskBadge riskLevel={worstRisk} size="md" />
        </div>

        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-navy-650 mb-6" style={{ height: 360 }}>
          {/* Reuses LiveMap itself, scoped to this zone's nodes, rather than
              a second map component — see LiveMap's scopeToZoneId prop. */}
          <LiveMap scopeToZoneId={zone.id} />
        </div>

        <div className="bg-white dark:bg-navy-850 border border-slate-200 dark:border-navy-650 rounded-xl shadow-sm dark:shadow-lg dark:shadow-black/20 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-navy-650">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Nodes in this zone ({zoneNodes.length})
            </p>
          </div>
          {zoneNodes.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
              No nodes registered in this zone yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-navy-650 text-left">
                  <th className="px-5 py-2.5 font-medium text-slate-500 dark:text-slate-400">
                    Node
                  </th>
                  <th className="px-5 py-2.5 font-medium text-slate-500 dark:text-slate-400">
                    Source
                  </th>
                  <th className="px-5 py-2.5 font-medium text-slate-500 dark:text-slate-400">
                    Risk
                  </th>
                  <th className="px-5 py-2.5 font-medium text-slate-500 dark:text-slate-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {zoneNodes.map(({ node, riskLevel }) => (
                  <tr
                    key={node.id}
                    className="border-b border-slate-100 dark:border-navy-800 last:border-0"
                  >
                    <td className="px-5 py-2.5">
                      <p className="text-slate-900 dark:text-slate-100">
                        {node.node_name || node.node_id}
                      </p>
                      {node.node_name && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                          {node.node_id}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-slate-500 dark:text-slate-400 text-xs">
                      {node.data_source === "real" ? "Real" : "Simulated"}
                    </td>
                    <td className="px-5 py-2.5">
                      <RiskBadge riskLevel={riskLevel} size="sm" />
                    </td>
                    <td className="px-5 py-2.5 text-slate-500 dark:text-slate-400 text-xs capitalize">
                      {node.status}
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

export default ZoneDetailsPage;
