import { useApiResource } from "./useApiResource.js";
import { useRiskForNode, useInfluenceZoneForNode } from "../store/mapDataStore.js";

// Fuses risk + influence-zone + anomaly + prediction data for one node into
// a single hook, per the plan's "one hook fusing three endpoints" design —
// a Node Details page component shouldn't have to combine four separate
// fetches itself.
//
// Risk and influence-zone are NOT new fetches — they read directly from
// mapDataStore's existing slices (the same data LiveMap/Overview/NodesPage
// already poll), so this hook doesn't duplicate that traffic.
//
// CONFIRMED against the real backend router (anomalies.py / predictions.py):
// GET /api/nodes/{node_id}/anomalies/latest and
// GET /api/nodes/{node_id}/predictions/latest — path order corrected from
// an earlier wrong guess (/api/anomalies/nodes/{id}/latest).
export function useNodeAiExplanation(numericNodeId, stringNodeId) {
  const risk = useRiskForNode(numericNodeId);
  const influenceZone = useInfluenceZoneForNode(stringNodeId);

  const anomaly = useApiResource(
    stringNodeId ? `/api/nodes/${stringNodeId}/anomalies/latest` : null
  );
  const prediction = useApiResource(
    stringNodeId ? `/api/nodes/${stringNodeId}/predictions/latest` : null
  );

  return {
    risk,
    influenceZone,
    anomaly: anomaly.data,
    anomalyError: anomaly.error,
    anomalyLoading: anomaly.isLoading,
    prediction: prediction.data,
    predictionError: prediction.error,
    predictionLoading: prediction.isLoading,
  };
}

export default useNodeAiExplanation;
