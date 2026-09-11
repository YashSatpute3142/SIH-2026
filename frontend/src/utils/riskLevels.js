// Shared risk-level constants and resolution logic — the single source of
// truth for how a node's risk level is displayed and colored across the app.
// Extracted from LiveMap.jsx (Chat 8B) so Overview and any future page never
// have to re-implement this safety-sensitive logic independently and risk
// drifting from it over time.
//
// Behavior is unchanged from the original LiveMap.jsx implementation — this
// file is a pure extraction, not a logic change.

// Each risk level carries a light-theme color (flat, high-saturation — good
// for small badges/icons regardless of theme) and a dark-theme color
// (deepened, desaturated — same hue identity, so the meaning never changes,
// only the intensity, keeping dark-mode surfaces rich instead of neon).
// Label + icon always accompany color everywhere this is used; nothing
// relies on color alone.
export const RISK_LEVELS = {
  GREEN: { light: "#22c55e", dark: "#3f9463", label: "Green", icon: "\u2713" },
  YELLOW: { light: "#eab308", dark: "#c9a227", label: "Yellow", icon: "!" },
  ORANGE: { light: "#f97316", dark: "#d97a3f", label: "Orange", icon: "\u203C" },
  RED: { light: "#ef4444", dark: "#c4453f", label: "Red", icon: "\u2715" },
  GREY: { light: "#6b7280", dark: "#6b7787", label: "No Data", icon: "?" },
};

export const RISK_RANK = { GREEN: 0, YELLOW: 1, GREY: 1, ORANGE: 2, RED: 3 };

// Missing risk data or an offline node always resolves to GREY — never GREEN.
// This is the hard project-wide rule (missing data is never treated as
// stable) and must never be re-implemented differently elsewhere.
export function resolveRiskLevel(node, risk) {
  if (!risk) return "GREY";
  if (node.status === "offline") return "GREY";
  return risk.risk_level in RISK_LEVELS ? risk.risk_level : "GREY";
}

export function getRiskColor(riskLevel, theme) {
  const info = RISK_LEVELS[riskLevel] || RISK_LEVELS.GREY;
  return theme === "dark" ? info.dark : info.light;
}

// Shared zone-worst-risk computation — the "worst risk among a zone's
// nodes" rule used by both LiveMap's zone-boundary tooltip/color and the
// Zones list page. A zone with no nodes resolves to GREY (no data to judge
// by), never GREEN — consistent with the same never-assume-safe rule
// resolveRiskLevel enforces per node.
export function computeZoneWorstRisk(zoneId, nodesById, risksByNodeId) {
  const zoneNodes = Object.values(nodesById).filter((n) => n.zone_id === zoneId);
  if (zoneNodes.length === 0) return "GREY";

  let worst = "GREEN";
  for (const node of zoneNodes) {
    const risk = risksByNodeId[node.id];
    const level = resolveRiskLevel(node, risk);
    if (RISK_RANK[level] > RISK_RANK[worst]) {
      worst = level;
    }
  }
  return worst;
}
