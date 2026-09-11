import { memo } from "react";
import { useTheme } from "../../store/themeStore.js";
import { RISK_LEVELS, getRiskColor } from "../../utils/riskLevels.js";

// Shared risk-level pill: icon + label + color together, always — never
// color alone. Built on the same RISK_LEVELS/getRiskColor source LiveMap
// and Overview already use, so every page renders a given risk_level
// identically instead of each page inventing its own badge styling.
//
// Usage: <RiskBadge riskLevel={risk.risk_level} node={node} />
// `node` is optional — pass it to get the same offline/missing-data ->
// GREY resolution LiveMap uses; omit it if you already have a resolved
// level string in hand.

const SIZE_CLASSES = {
  sm: "px-2 py-0.5 text-xs gap-1",
  md: "px-3 py-1.5 text-sm gap-1.5",
};

const DOT_SIZE_CLASSES = {
  sm: "w-3.5 h-3.5 text-[9px]",
  md: "w-4 h-4 text-[10px]",
};

const RiskBadge = memo(function RiskBadge({ riskLevel, size = "md", count, className = "" }) {
  const theme = useTheme();
  const level = riskLevel in RISK_LEVELS ? riskLevel : "GREY";
  const info = RISK_LEVELS[level];
  const color = getRiskColor(level, theme);

  return (
    <span
      className={`inline-flex items-center rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-650 ${SIZE_CLASSES[size]} ${className}`}
    >
      <span
        className={`rounded-full flex items-center justify-center font-bold shrink-0 ${DOT_SIZE_CLASSES[size]}`}
        style={{ backgroundColor: color, color: "#0f172a" }}
      >
        {info.icon}
      </span>
      <span className="text-slate-700 dark:text-slate-300">{info.label}</span>
      {count !== undefined && (
        <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
          {count}
        </span>
      )}
    </span>
  );
});

export default RiskBadge;
