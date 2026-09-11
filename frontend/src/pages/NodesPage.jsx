import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  useZonesById,
  useNodesById,
  useRisksByNodeId,
  useMapDataLoading,
  useMapDataError,
  useMapDataActions,
} from "../store/mapDataStore.js";
import { useUser } from "../store/authStore.js";
import { useNodeMutations } from "../hooks/useNodeMutations.js";
import { resolveRiskLevel } from "../utils/riskLevels.js";
import { DEFAULT_MAP_CENTER } from "../utils/mapTiles.js";
import RiskBadge from "../components/shared/RiskBadge.jsx";
import NodeFormModal from "../components/nodes/NodeFormModal.jsx";

// Node registration/edit/deregister is role-gated server-side to
// admin/operator (Chat 8 backend, auth/dependencies.py's require_role).
// This mirrors that gate client-side purely for UI presentation — the
// server is still the actual enforcement point, this just avoids showing
// controls a viewer would get a 403 from.
const MUTATION_ROLES = ["admin", "operator"];

function useNodeList(nodesById, zonesById, risksByNodeId, query) {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.values(nodesById)
      .filter((node) => {
        if (!q) return true;
        return (
          node.node_id.toLowerCase().includes(q) ||
          (node.node_name && node.node_name.toLowerCase().includes(q))
        );
      })
      .map((node) => ({
        node,
        zone: zonesById[node.zone_id],
        riskLevel: resolveRiskLevel(node, risksByNodeId[node.id]),
      }))
      .sort((a, b) => a.node.node_id.localeCompare(b.node.node_id));
  }, [nodesById, zonesById, risksByNodeId, query]);
}

function useDefaultMapCenter(nodesById) {
  return useMemo(() => {
    const nodes = Object.values(nodesById);
    if (nodes.length === 0) return DEFAULT_MAP_CENTER;
    const avgLat = nodes.reduce((sum, n) => sum + n.latitude, 0) / nodes.length;
    const avgLng = nodes.reduce((sum, n) => sum + n.longitude, 0) / nodes.length;
    return [avgLat, avgLng];
  }, [nodesById]);
}

function DataSourceTag({ dataSource }) {
  const isReal = dataSource === "real";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
        isReal
          ? "text-accent-600 dark:text-accent-400 border-accent-500/40 bg-accent-500/5"
          : "text-slate-500 dark:text-slate-400 border-slate-300 dark:border-navy-650 bg-slate-50 dark:bg-navy-900"
      }`}
    >
      {isReal ? "REAL" : "SIMULATED"}
    </span>
  );
}

function NodeStatusTag({ status }) {
  const map = {
    online: {
      label: "Online",
      className: "text-emerald-600 dark:text-emerald-400",
    },
    offline: {
      label: "Offline",
      className: "text-slate-500 dark:text-slate-500",
    },
    decommissioned: {
      label: "Decommissioned",
      className: "text-red-500 dark:text-red-400/80",
    },
  };
  const entry = map[status] || { label: status || "Unknown", className: "text-slate-500" };
  return <span className={`text-xs font-medium ${entry.className}`}>{entry.label}</span>;
}

function DeregisterAction({ node, onDeregister, isSubmitting }) {
  const [confirming, setConfirming] = useState(false);

  if (node.status === "decommissioned") {
    return <span className="text-xs text-slate-400 dark:text-slate-600">&mdash;</span>;
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => {
            onDeregister(node.node_id);
            setConfirming(false);
          }}
          disabled={isSubmitting}
          className="text-xs font-medium px-2 py-1 rounded-md bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
        >
          Confirm
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs font-medium px-2 py-1 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs font-medium text-red-500 dark:text-red-400/90 hover:text-red-600 dark:hover:text-red-400 transition-colors"
    >
      Deregister
    </button>
  );
}

function NodesTable({ rows, canMutate, onEdit, onDeregister, isSubmitting }) {
  if (rows.length === 0) {
    return (
      <div className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
        No nodes match your search.
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 dark:border-navy-650 text-left">
          <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">Node</th>
          <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">Source</th>
          <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">Zone</th>
          <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">Risk</th>
          <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">Status</th>
          <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">Last Seen</th>
          {canMutate && (
            <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">
              Actions
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ node, zone, riskLevel }) => (
          <tr
            key={node.id}
            className="border-b border-slate-100 dark:border-navy-800 last:border-0 hover:bg-slate-50 dark:hover:bg-navy-900/60 transition-colors"
          >
            <td className="px-5 py-3">
              <Link
                to={`/dashboard/nodes/${node.node_id}`}
                className="font-medium text-slate-900 dark:text-slate-100 hover:text-accent-600 dark:hover:text-accent-400 transition-colors"
              >
                {node.node_name || node.node_id}
              </Link>
              {node.node_name && (
                <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                  {node.node_id}
                </p>
              )}
            </td>
            <td className="px-5 py-3">
              <DataSourceTag dataSource={node.data_source} />
            </td>
            <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
              {zone ? zone.name : `Zone ${node.zone_id}`}
            </td>
            <td className="px-5 py-3">
              <RiskBadge riskLevel={riskLevel} size="sm" />
            </td>
            <td className="px-5 py-3">
              <NodeStatusTag status={node.status} />
            </td>
            <td className="px-5 py-3 text-slate-500 dark:text-slate-500 text-xs">
              {node.last_seen_at ? new Date(node.last_seen_at).toLocaleString() : "Never"}
            </td>
            {canMutate && (
              <td className="px-5 py-3">
                <div className="flex items-center justify-end gap-3">
                  {node.status === "decommissioned" ? (
                    <span className="text-xs text-slate-300 dark:text-slate-600 cursor-not-allowed">
                      Edit
                    </span>
                  ) : (
                    <button
                      onClick={() => onEdit(node)}
                      className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                    >
                      Edit
                    </button>
                  )}
                  <DeregisterAction
                    node={node}
                    onDeregister={onDeregister}
                    isSubmitting={isSubmitting}
                  />
                </div>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NodesPage() {
  const nodesById = useNodesById();
  const zonesById = useZonesById();
  const risksByNodeId = useRisksByNodeId();
  const isLoading = useMapDataLoading();
  const error = useMapDataError();
  const { startPolling, stopPolling } = useMapDataActions();
  const user = useUser();
  const {
    createNode,
    updateNode,
    deregisterNode,
    isSubmitting,
    error: mutationError,
  } = useNodeMutations();
  const [query, setQuery] = useState("");
  const [formMode, setFormMode] = useState(null); // null | "create" | "edit"
  const [editingNode, setEditingNode] = useState(null);

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const rows = useNodeList(nodesById, zonesById, risksByNodeId, query);
  const defaultCenter = useDefaultMapCenter(nodesById);
  const canMutate = MUTATION_ROLES.includes(user?.role);

  const handleDeregister = useCallback(
    (nodeId) => {
      deregisterNode(nodeId).catch(() => {
        // error already captured in mutationError for display; swallow here
        // so an unhandled rejection doesn't surface for a handled failure.
      });
    },
    [deregisterNode]
  );

  const openCreateForm = useCallback(() => {
    setEditingNode(null);
    setFormMode("create");
  }, []);

  const openEditForm = useCallback((node) => {
    setEditingNode(node);
    setFormMode("edit");
  }, []);

  const closeForm = useCallback(() => {
    setFormMode(null);
    setEditingNode(null);
  }, []);

  const handleFormSubmit = useCallback(
    (payload) => {
      if (formMode === "edit") {
        return updateNode(editingNode.node_id, payload);
      }
      return createNode(payload);
    },
    [formMode, editingNode, createNode, updateNode]
  );

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-navy-975 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
              Nodes
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {Object.keys(nodesById).length} registered &middot; real and simulated nodes
              shown identically
            </p>
          </div>
          {canMutate && (
            <button
              onClick={openCreateForm}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-500 text-white hover:bg-accent-600 transition-colors"
            >
              + Add Node
            </button>
          )}
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
            placeholder="Search by node ID or name..."
            className="w-full max-w-sm bg-white dark:bg-navy-850 border border-slate-200 dark:border-navy-650 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </div>

        <div className="bg-white dark:bg-navy-850 border border-slate-200 dark:border-navy-650 rounded-xl shadow-sm dark:shadow-lg dark:shadow-black/20 overflow-hidden">
          {isLoading && Object.keys(nodesById).length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
              Loading nodes...
            </div>
          ) : (
            <NodesTable
              rows={rows}
              canMutate={canMutate}
              onEdit={openEditForm}
              onDeregister={handleDeregister}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </div>

      {formMode && (
        <NodeFormModal
          mode={formMode}
          node={editingNode}
          zonesById={zonesById}
          defaultCenter={defaultCenter}
          isSubmitting={isSubmitting}
          error={mutationError}
          onSubmit={handleFormSubmit}
          onClose={closeForm}
        />
      )}
    </div>
  );
}

export default NodesPage;
