import { useApiResource } from "./useApiResource.js";

// Thin wrapper per the shared-foundation pattern — GET /api/alerts is
// confirmed live (handover: "GET /api/alerts — 200, empty array" tested
// against the real backend), so this endpoint itself is not a guess.
// Filter params (status, zone_id, node_id, limit) are passed straight
// through to apiGet as query params.
export function useAlerts(params = {}, options = {}) {
  return useApiResource("/api/alerts", { params, pollIntervalMs: options.pollIntervalMs });
}

export default useAlerts;
