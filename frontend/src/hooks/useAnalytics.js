import { useMemo } from "react";
import { useApiResource } from "./useApiResource.js";
import { useNodesById, useRisksByNodeId } from "../store/mapDataStore.js";
import { RISK_LEVELS, resolveRiskLevel } from "../utils/riskLevels.js";

// All four Analytics charts are designed to use ONLY confirmed data sources
// — no guessed endpoints. Risk distribution and data quality are pure
// derivations from mapDataStore's already-fetched risksByNodeId (zero new
// fetches). Anomaly and prediction trends use the CONFIRMED list endpoints
// from anomalies.py/predictions.py (zone_id-filterable, ordered by
// detected_at/predicted_at desc) rather than per-node history loops.
//
// Deliberately NOT built here: a true "predicted vs. observed displacement"
// comparison or a raw displacement trend chart — both would need the
// processed-reading history endpoint (reads.py), which hasn't been shown to
// me and whose route I won't guess for something this data-shape-sensitive.
// Prediction trend below charts predicted_displacement_mm over time on its
// own, honestly labeled as predicted-only, not compared against a value I
// don't have confirmed access to.

export function useRiskDistribution() {
  const nodesById = useNodesById();
  const risksByNodeId = useRisksByNodeId();

  return useMemo(() => {
    const counts = { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0, GREY: 0 };
    for (const node of Object.values(nodesById)) {
      const level = resolveRiskLevel(node, risksByNodeId[node.id]);
      counts[level] = (counts[level] || 0) + 1;
    }
    return Object.keys(RISK_LEVELS).map((key) => ({
      key,
      label: RISK_LEVELS[key].label,
      value: counts[key],
    }));
  }, [nodesById, risksByNodeId]);
}

const QUALITY_ORDER = ["good", "fair", "poor", "unknown"];

export function useDataQualityDistribution() {
  const risksByNodeId = useRisksByNodeId();

  return useMemo(() => {
    const counts = { good: 0, fair: 0, poor: 0, unknown: 0 };
    for (const risk of Object.values(risksByNodeId)) {
      const status = risk.data_quality_status && QUALITY_ORDER.includes(risk.data_quality_status)
        ? risk.data_quality_status
        : "unknown";
      counts[status] += 1;
    }
    return QUALITY_ORDER.map((key) => ({ key, label: key, value: counts[key] }));
  }, [risksByNodeId]);
}

// CONFIRMED endpoint (anomalies.py): GET /api/anomalies, zone_id-filterable,
// ordered by detected_at desc server-side.
export function useAnomalyTrend(zoneId = null, limit = 100) {
  const params = zoneId != null ? { zone_id: zoneId, limit } : { limit };
  const { data, isLoading, error } = useApiResource("/api/anomalies", {
    params,
    pollIntervalMs: 30000,
  });
  // Server returns newest-first; charts read left-to-right chronologically.
  const chronological = useMemo(() => (data ? [...data].reverse() : []), [data]);
  return { data: chronological, isLoading, error };
}

// CONFIRMED endpoint (predictions.py): GET /api/predictions,
// zone_id/trend_direction-filterable, ordered by predicted_at desc.
export function usePredictionTrend(zoneId = null, limit = 100) {
  const params = zoneId != null ? { zone_id: zoneId, limit } : { limit };
  const { data, isLoading, error } = useApiResource("/api/predictions", {
    params,
    pollIntervalMs: 30000,
  });
  const chronological = useMemo(() => (data ? [...data].reverse() : []), [data]);
  return { data: chronological, isLoading, error };
}
