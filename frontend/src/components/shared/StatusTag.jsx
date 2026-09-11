import { memo } from "react";
import { useTheme } from "../../store/themeStore.js";

// Master Plan hard constraint: "Every value shown in the UI must be tagged
// with a status: Live / Simulated / Historical / Predicted / Unavailable /
// Stale." This is the single shared component for that — built once here
// so every page (Nodes, Zones, Alerts, Analytics, AI panel, etc.) renders
// the same six statuses identically instead of inventing its own tag.
//
// Distinct from RiskBadge: RiskBadge communicates a node's *risk level*
// (GREEN/YELLOW/ORANGE/RED/GREY). StatusTag communicates the *provenance/
// freshness* of the value being shown next to it. A single card can show
// both, e.g. a RED risk badge next to a "Stale" status tag if the reading
// backing that risk is old.

export const STATUS_META = {
  live: { light: "#16a34a", dark: "#3f9463", label: "Live", icon: "\u25CF" },
  simulated: { light: "#0284c7", dark: "#3d7ea6", label: "Simulated", icon: "S" },
  historical: { light: "#7c3aed", dark: "#7c6bb0", label: "Historical", icon: "\u29D6" },
  predicted: { light: "#a21caf", dark: "#9d5f9e", label: "Predicted", icon: "\u223F" },
  unavailable: { light: "#6b7280", dark: "#6b7787", label: "Unavailable", icon: "\u2715" },
  stale: { light: "#d97706", dark: "#c9862f", label: "Stale", icon: "\u23F3" },
};

const SIZE_CLASSES = {
  sm: "px-2 py-0.5 text-[11px] gap-1",
  md: "px-2.5 py-1 text-xs gap-1.5",
};

const StatusTag = memo(function StatusTag({ status, size = "sm", className = "" }) {
  const theme = useTheme();
  const key = status in STATUS_META ? status : "unavailable";
  const meta = STATUS_META[key];
  const color = theme === "dark" ? meta.dark : meta.light;

  return (
    <span
      className={`inline-flex items-center rounded-md border ${SIZE_CLASSES[size]} ${className}`}
      style={{
        color,
        borderColor: color,
        backgroundColor: theme === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
      }}
    >
      <span aria-hidden="true">{meta.icon}</span>
      <span className="font-medium">{meta.label}</span>
    </span>
  );
});

export default StatusTag;
