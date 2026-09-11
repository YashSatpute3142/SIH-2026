import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { apiGet } from "../utils/apiClient.js";

const POLL_INTERVAL_MS = 15000;

let pollTimer = null;

function keyById(items) {
  const map = {};
  for (const item of items) {
    map[item.id] = item;
  }
  return map;
}

function latestRiskPerNode(risks) {
  const map = {};
  for (const risk of risks) {
    const existing = map[risk.node_id];
    if (!existing || new Date(risk.evaluated_at) > new Date(existing.evaluated_at)) {
      map[risk.node_id] = risk;
    }
  }
  return map;
}

// InfluenceZoneOut is keyed by the string node_id (e.g. "NODE-A-01"), unlike
// nodesById/risksByNodeId which stay on the existing numeric PK for backward
// compatibility. Kept as its own string-keyed slice rather than forcing a
// join into the numeric-keyed maps — see HANDOVER decision: numeric store
// key stays put, new endpoints get their own lookup alongside it.
function keyByNodeId(zones) {
  const map = {};
  for (const zone of zones) {
    map[zone.node_id] = zone;
  }
  return map;
}

const useMapDataStore = create((set, get) => ({
  zonesById: {},
  nodesById: {},
  risksByNodeId: {},
  influenceZonesByNodeId: {},
  isLoading: false,
  error: null,
  lastFetchedAt: null,

  fetchZones: async () => {
    const zones = await apiGet("/api/zones");
    set({ zonesById: keyById(zones) });
    return zones;
  },

  fetchNodes: async () => {
    const nodes = await apiGet("/api/nodes");
    set({ nodesById: keyById(nodes) });
    return nodes;
  },

  fetchRisks: async () => {
    const risks = await apiGet("/api/risks", { limit: 500 });
    set((state) => ({
      risksByNodeId: { ...state.risksByNodeId, ...latestRiskPerNode(risks) },
    }));
    return risks;
  },

  // GREY nodes are excluded from this response by the backend formula itself
  // (missing data is never evidence of risk, so no zone is drawn for them) —
  // the store just stores whatever comes back, no client-side filtering needed.
  fetchInfluenceZones: async () => {
    const zones = await apiGet("/api/influence-zones");
    set({ influenceZonesByNodeId: keyByNodeId(zones) });
    return zones;
  },

  refreshAll: async () => {
    set({ isLoading: true, error: null });
    try {
      await Promise.all([
        get().fetchZones(),
        get().fetchNodes(),
        get().fetchRisks(),
        get().fetchInfluenceZones(),
      ]);
      set({ isLoading: false, lastFetchedAt: new Date().toISOString() });
    } catch (error) {
      set({ isLoading: false, error: error.message || "Failed to load map data" });
    }
  },

  startPolling: () => {
    if (pollTimer) return;
    get().refreshAll();
    pollTimer = setInterval(() => {
      get().refreshAll();
    }, POLL_INTERVAL_MS);
  },

  stopPolling: () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  },
}));

export const useZonesById = () => useMapDataStore((state) => state.zonesById);
export const useNodesById = () => useMapDataStore((state) => state.nodesById);
export const useRisksByNodeId = () => useMapDataStore((state) => state.risksByNodeId);
export const useInfluenceZonesByNodeId = () =>
  useMapDataStore((state) => state.influenceZonesByNodeId);
export const useMapDataLoading = () => useMapDataStore((state) => state.isLoading);
export const useMapDataError = () => useMapDataStore((state) => state.error);

export const useNodeById = (nodeId) =>
  useMapDataStore((state) => state.nodesById[nodeId]);

export const useRiskForNode = (nodeId) =>
  useMapDataStore((state) => state.risksByNodeId[nodeId]);

// Keyed by string node_id (e.g. "NODE-A-01"), not the numeric PK — pass
// node.node_id, not node.id, when calling this.
export const useInfluenceZoneForNode = (stringNodeId) =>
  useMapDataStore((state) => state.influenceZonesByNodeId[stringNodeId]);

export const useMapDataActions = () =>
  useMapDataStore(
    useShallow((state) => ({
      refreshAll: state.refreshAll,
      startPolling: state.startPolling,
      stopPolling: state.stopPolling,
    }))
  );

export default useMapDataStore;
