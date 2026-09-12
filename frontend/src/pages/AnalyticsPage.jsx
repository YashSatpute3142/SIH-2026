import { useMemo } from "react";
import {
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "../store/themeStore.js";
import { getRiskColor } from "../utils/riskLevels.js";
import {
  useRiskDistribution,
  useDataQualityDistribution,
  useAnomalyTrend,
  usePredictionTrend,
} from "../hooks/useAnalytics.js";
import StatusTag from "../components/shared/StatusTag.jsx";

const QUALITY_COLORS = {
  light: { good: "#16a34a", fair: "#d97706", poor: "#dc2626", unknown: "#94a3b8" },
  dark: { good: "#3f9463", fair: "#c9862f", poor: "#c4453f", unknown: "#6b7787" },
};

function ChartCard({ title, statusTag, children, note }) {
  return (
    <div className="bg-white dark:bg-navy-850 border border-slate-200 dark:border-navy-650 rounded-xl px-5 py-4 shadow-sm dark:shadow-lg dark:shadow-black/20">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          {title}
        </p>
        {statusTag && <StatusTag status={statusTag} />}
      </div>
      {children}
      {note && <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">{note}</p>}
    </div>
  );
}

function useChartTheme() {
  const theme = useTheme();
  return {
    theme,
    gridColor: theme === "dark" ? "#2a3448" : "#e2e8f0",
    axisColor: theme === "dark" ? "#64748b" : "#94a3b8",
    tooltipBg: theme === "dark" ? "#141a29" : "#ffffff",
    tooltipBorder: theme === "dark" ? "#2a3448" : "#e2e8f0",
    accent: theme === "dark" ? "#38bdf8" : "#0284c7",
  };
}

function RiskDistributionChart() {
  const data = useRiskDistribution();
  const { theme, gridColor, axisColor, tooltipBg, tooltipBorder } = useChartTheme();
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <ChartCard
      title="Risk Distribution"
      statusTag="live"
      note={total === 0 ? "No nodes registered yet" : `${total} nodes total`}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 12 }} axisLine={{ stroke: gridColor }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.key} fill={getRiskColor(d.key, theme)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function DataQualityChart() {
  const data = useDataQualityDistribution();
  const { theme, gridColor, axisColor, tooltipBg, tooltipBorder } = useChartTheme();
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const colors = QUALITY_COLORS[theme];

  return (
    <ChartCard
      title="Data Quality"
      statusTag="live"
      note={total === 0 ? "No risk evaluations yet" : `Based on ${total} latest risk evaluations`}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 12 }} axisLine={{ stroke: gridColor }} tickLine={false} className="capitalize" />
          <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.key} fill={colors[d.key]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function AnomalyTrendChart() {
  const { data, isLoading, error } = useAnomalyTrend(null, 100);
  const { gridColor, axisColor, tooltipBg, tooltipBorder, accent } = useChartTheme();

  const chartData = useMemo(
    () => data.map((a) => ({ time: a.detected_at, score: a.anomaly_score })),
    [data]
  );

  return (
    <ChartCard
      title="Anomaly Score Trend"
      statusTag="live"
      note="Most recent 100 anomaly evaluations, mine-wide"
    >
      {error ? (
        <p className="text-sm text-red-500 dark:text-red-400 py-8 text-center">{error}</p>
      ) : isLoading && chartData.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">Loading...</p>
      ) : chartData.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">
          No anomaly evaluations yet
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fill: axisColor, fontSize: 11 }} axisLine={{ stroke: gridColor }} tickLine={false} />
            <YAxis tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              labelFormatter={(v) => new Date(v).toLocaleString()}
              contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
            />
            <Line type="monotone" dataKey="score" stroke={accent} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function PredictionTrendChart() {
  const { data, isLoading, error } = usePredictionTrend(null, 100);
  const { gridColor, axisColor, tooltipBg, tooltipBorder } = useChartTheme();

  const chartData = useMemo(
    () =>
      data.map((p) => ({
        time: p.predicted_at,
        value: p.predicted_displacement_mm,
        trend: p.trend_direction,
      })),
    [data]
  );

  return (
    <ChartCard
      title="Predicted Displacement Trend"
      statusTag="predicted"
      note="Synthetic-data model output — decision support only, not a guarantee of real-world accuracy"
    >
      {error ? (
        <p className="text-sm text-red-500 dark:text-red-400 py-8 text-center">{error}</p>
      ) : isLoading && chartData.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">Loading...</p>
      ) : chartData.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">
          No predictions yet
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fill: axisColor, fontSize: 11 }} axisLine={{ stroke: gridColor }} tickLine={false} />
            <YAxis tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} unit=" mm" />
            <Tooltip
              labelFormatter={(v) => new Date(v).toLocaleString()}
              contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
            />
            <Line type="monotone" dataKey="value" stroke="#a21caf" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function AnalyticsPage() {
  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-navy-975 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            Analytics
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Prototype data — every chart is tagged with its data status
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RiskDistributionChart />
          <DataQualityChart />
          <AnomalyTrendChart />
          <PredictionTrendChart />
        </div>
      </div>
    </div>
  );
}

export default AnalyticsPage;
