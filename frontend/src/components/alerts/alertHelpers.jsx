import { RISK_LEVELS } from "../../utils/riskLevels.js";
import RiskBadge from "../shared/RiskBadge.jsx";

// Normalizes a raw AlertOut object (alert_schemas.py, confirmed against the
// real backend) into the shape these components render. Field names below
// are now CONFIRMED, not guessed:
//   id, risk_id, zone_id, alert_level (GREEN/YELLOW/ORANGE/RED/GREY),
//   title (required), message (optional), affected_nodes (list, optional),
//   triggering_measurements, model_probability, anomaly_score,
//   data_quality_status, recommended_action, status
//   (active | acknowledged | resolved — NOT "open", an earlier wrong guess),
//   synchronization_status, created_at, resolved_at.
// Notably: there is NO node_id field on Alert — affected_nodes is the real
// field, and zone_id is always present (required, not optional).
// affected_nodes is Optional[list] in the schema — untyped, Pydantic
// doesn't enforce element type. Mapped defensively (string as-is, anything
// else JSON-stringified) rather than assumed to always be plain strings.
function normalizeAffectedNodes(list) {
  if (!list) return [];
  return list.map((item) => (typeof item === "string" ? item : JSON.stringify(item)));
}

export function normalizeAlert(alert) {
  return {
    id: alert.id,
    zoneId: alert.zone_id,
    affectedNodes: normalizeAffectedNodes(alert.affected_nodes),
    alertLevel: alert.alert_level,
    title: alert.title,
    message: alert.message,
    recommendedAction: alert.recommended_action,
    status: alert.status,
    createdAt: alert.created_at,
    resolvedAt: alert.resolved_at,
  };
}

// Status values corrected to match AlertStatus exactly: active | acknowledged
// | resolved (an earlier version of this file used "open", which doesn't
// exist in the schema).
const STATUS_META = {
  active: { label: "Active", className: "text-red-500 dark:text-red-400/90" },
  acknowledged: { label: "Acknowledged", className: "text-accent-600 dark:text-accent-400" },
  resolved: { label: "Resolved", className: "text-emerald-600 dark:text-emerald-400" },
};

export function AlertStatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, className: "text-slate-500" };
  return <span className={`text-xs font-medium ${meta.className}`}>{meta.label}</span>;
}

// alert_level is typed identically to RISK_LEVELS' keys (GREEN/YELLOW/
// ORANGE/RED/GREY per AlertLevel in alert_schemas.py), so this always hits
// the RiskBadge branch for a well-formed alert — the plain-text fallback
// only matters if the backend ever sends something outside that literal.
export function AlertSeverityBadge({ alertLevel }) {
  if (alertLevel && alertLevel in RISK_LEVELS) {
    return <RiskBadge riskLevel={alertLevel} size="sm" />;
  }
  if (!alertLevel) return null;
  return (
    <span className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-navy-900 border border-slate-200 dark:border-navy-650 rounded-md px-2 py-0.5">
      {alertLevel}
    </span>
  );
}

export function relativeTime(isoString) {
  if (!isoString) return "";
  const then = new Date(isoString).getTime();
  const diffMs = Date.now() - then;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}
