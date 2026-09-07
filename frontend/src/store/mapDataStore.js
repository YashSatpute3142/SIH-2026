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

const useMapDataStore = create((set, get) => ({
  zonesById: {},
  nodesById: {},
  risksByNodeId: {},
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

  refreshAll: async () => {
    set({ isLoading: true, error: null });
    try {
      await Promise.all([get().fetchZones(), get().fetchNodes(), get().fetchRisks()]);
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
export const useMapDataLoading = () => useMapDataStore((state) => state.isLoading);
export const useMapDataError = () => useMapDataStore((state) => state.error);

export const useNodeById = (nodeId) =>
  useMapDataStore((state) => state.nodesById[nodeId]);

export const useRiskForNode = (nodeId) =>
  useMapDataStore((state) => state.risksByNodeId[nodeId]);

export const useMapDataActions = () =>
  useMapDataStore(
    useShallow((state) => ({
      refreshAll: state.refreshAll,
      startPolling: state.startPolling,
      stopPolling: state.stopPolling,
    }))
  );

export default useMapDataStore;
