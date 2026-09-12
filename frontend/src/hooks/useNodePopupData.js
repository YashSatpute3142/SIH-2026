import { useApiResource } from "./useApiResource.js";

// CONFIRMED against the real backend (reads.py): the most recent RAW
// reading (battery_voltage, tilt_magnitude, displacement_mm, temperature,
// etc.) is NOT available via /readings/latest — that endpoint returns
// SensorReadingProcessedOut, which only has derived/trend fields
// (tilt_rate, battery_trend, data_quality_score...), no raw instantaneous
// values at all. There is no dedicated "latest raw" endpoint, so this pulls
// GET /api/nodes/{node_id}/readings/raw?limit=1 and takes the first item
// (already ordered by reading_timestamp desc server-side).
//
// `enabled` gates the fetch — pass false/undefined until a marker's popup
// is actually opened, so this stays a per-click lazy fetch rather than
// firing for every node on the map at once (the N+1 problem the original
// plan flagged and this was deliberately deferred to avoid).
export function useNodePopupData(stringNodeId, enabled) {
  const { data, isLoading, error } = useApiResource(
    enabled && stringNodeId ? `/api/nodes/${stringNodeId}/readings/raw` : null,
    { params: { limit: 1 } }
  );

  const latest = data && data.length > 0 ? data[0] : null;
  return { latest, isLoading, error };
}

export default useNodePopupData;
