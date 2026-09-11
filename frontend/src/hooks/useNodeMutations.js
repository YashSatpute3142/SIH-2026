import { useState, useCallback } from "react";
import { apiPost, apiPatch, apiDelete } from "../utils/apiClient.js";
import useMapDataStore from "../store/mapDataStore.js";

// Consolidated node mutation hook — create/update/deregister together,
// rather than three separate files, since they share the same
// error/submitting state and are always used from the same
// form/row-actions context (per HANDOVER_CHAT8's file-count reasoning).
//
// Deliberately does NOT keep its own copy of the node list. mapDataStore's
// nodesById is already the single source of truth for node data (used by
// both LiveMap and, going forward, the Nodes page table) — after any
// successful mutation this hook just re-triggers that store's fetchNodes()
// so every consumer of nodesById updates together, instead of the Nodes
// page maintaining a second, potentially-drifting copy of the same data.
export function useNodeMutations() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const fetchNodes = useMapDataStore((state) => state.fetchNodes);

  const createNode = useCallback(
    async (payload) => {
      setIsSubmitting(true);
      setError(null);
      try {
        // payload shape matches NodeCreate: node_id, node_name, zone_id,
        // data_source, sensor_types, latitude, longitude, is_reference_node,
        // calibration_status. Backend rejects duplicate node_id with 409 —
        // that message surfaces here via err.message for the form to show.
        const node = await apiPost("/api/nodes", payload);
        await fetchNodes();
        return node;
      } catch (err) {
        setError(err.message || "Failed to create node");
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [fetchNodes]
  );

  const updateNode = useCallback(
    async (nodeId, payload) => {
      setIsSubmitting(true);
      setError(null);
      try {
        // payload shape matches NodeUpdate. node_id/data_source are
        // immutable post-registration by design and must not be included.
        const node = await apiPatch(`/api/nodes/${nodeId}`, payload);
        await fetchNodes();
        return node;
      } catch (err) {
        setError(err.message || "Failed to update node");
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [fetchNodes]
  );

  const deregisterNode = useCallback(
    async (nodeId) => {
      setIsSubmitting(true);
      setError(null);
      try {
        // Soft delete server-side (status -> "decommissioned"); history is
        // preserved. No client-side special-casing needed.
        await apiDelete(`/api/nodes/${nodeId}`);
        await fetchNodes();
      } catch (err) {
        setError(err.message || "Failed to deregister node");
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [fetchNodes]
  );

  return { createNode, updateNode, deregisterNode, isSubmitting, error };
}

export default useNodeMutations;
