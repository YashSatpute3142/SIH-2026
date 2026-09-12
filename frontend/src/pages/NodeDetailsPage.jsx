import { useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useNodesById, useZonesById, useMapDataActions } from "../store/mapDataStore.js";
import { useNodeAiExplanation } from "../hooks/useNodeAiExplanation.js";
import { resolveRiskLevel } from "../utils/riskLevels.js";
import RiskBadge from "../components/shared/RiskBadge.jsx";
import StatusTag from "../components/shared/StatusTag.jsx";

function Card({ title, children, className = "" }) {
  return (
    <div
      className={`bg-white dark:bg-navy-850 border border-slate-200 dark:border-navy-650 rounded-xl px-5 py-4 shadow-sm dark:shadow-lg dark:shadow-black/20 ${className}`}
    >
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide">
        {title}
      </p>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-navy-800 last:border-0">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm text-slate-800 dark:text-slate-200 font-medium">{value}</span>
    </div>
  );
}

function ContributingFeatures({ features }) {
  if (!features || Object.keys(features).length === 0) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">Not available</p>;
  }

  const entries = Object.entries(features).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const maxAbs = Math.max(...entries.map(([, v]) => Math.abs(v)), 0.0001);

  return (
    <div className="space-y-2">
      {entries.map(([name, value]) => (
        <div key={name}>
          <div className="flex items-center justify-between text-xs mb-0.5">
            <span className="text-slate-600 dark:text-slate-300">{name}</span>
            <span className="text-slate-500 dark:text-slate-400 tabular-nums">
              {value.toFixed(3)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-navy-900 overflow-hidden">
            <div
              className={`h-full rounded-full ${value >= 0 ? "bg-accent-500" : "bg-red-400"}`}
              style={{ width: `${(Math.abs(value) / maxAbs) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function EndpointError({ message }) {
  return (
    <p className="text-sm text-slate-400 dark:text-slate-500">
      {message || "No data available yet"}
    </p>
  );
}

function NodeDetailsPage() {
  const { nodeIdParam } = useParams();
  const nodesById = useNodesById();
  const zonesById = useZonesById();
  const { startPolling, stopPolling } = useMapDataActions();

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const node = useMemo(
    () => Object.values(nodesById).find((n) => n.node_id === nodeIdParam) || null,
    [nodesById, nodeIdParam]
  );

  const {
    risk,
    influenceZone,
    anomaly,
    anomalyError,
    prediction,
    predictionError,
  } = useNodeAiExplanation(node?.id, node?.node_id);

  if (Object.keys(nodesById).length > 0 && !node) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-navy-975">
        <div className="text-center">
          <p className="text-slate-500 dark:text-slate-400 mb-3">
            No node found for "{nodeIdParam}".
          </p>
          <Link to="/dashboard/nodes" className="text-accent-600 dark:text-accent-400 text-sm">
            &larr; Back to Nodes
          </Link>
        </div>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-navy-975">
        <p className="text-slate-400 dark:text-slate-500 text-sm">Loading node...</p>
      </div>
    );
  }

  const riskLevel = resolveRiskLevel(node, risk);
  const zone = zonesById[node.zone_id];

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-navy-975 p-6">
      <div className="max-w-5xl mx-auto">
        <Link
          to="/dashboard/nodes"
          className="text-sm text-accent-600 dark:text-accent-400 hover:underline"
        >
          &larr; Back to Nodes
        </Link>

        <div className="flex items-start justify-between gap-4 mt-3 mb-6 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
              {node.node_name || node.node_id}
            </h1>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              <span className="font-mono">{node.node_id}</span>
              {" \u00b7 "}
              {zone ? zone.name : `Zone ${node.zone_id}`}
              {" \u00b7 "}
              {node.data_source === "real" ? "Real sensor" : "Simulated sensor"}
            </p>
          </div>
          <RiskBadge riskLevel={riskLevel} size="md" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card title="Risk Assessment">
            {risk ? (
              <>
                <Field label="Rule Triggered" value={risk.rule_triggered} />
                <Field label="ML Risk Class" value={risk.ml_risk_class} />
                <Field
                  label="ML Probability"
                  value={risk.ml_probability != null ? risk.ml_probability.toFixed(3) : null}
                />
                <Field
                  label="Anomaly Score"
                  value={risk.anomaly_score != null ? risk.anomaly_score.toFixed(3) : null}
                />
                <Field label="Sensor Health" value={risk.sensor_health_status} />
                <Field label="Data Quality" value={risk.data_quality_status} />
                <Field label="Persistence (s)" value={risk.persistence_seconds} />
                <Field label="Neighbor Agreement" value={risk.neighbor_agreement_count} />
                <Field label="Evaluated" value={new Date(risk.evaluated_at).toLocaleString()} />
                {risk.recommended_action && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 pt-3 border-t border-slate-100 dark:border-navy-800">
                    {risk.recommended_action}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500">
                No risk evaluation yet
              </p>
            )}
          </Card>

          <Card title="Influence Zone">
            {influenceZone ? (
              <>
                <Field label="Radius" value={`${Math.round(influenceZone.radius_m)} m`} />
                <Field label="Risk Level" value={influenceZone.risk_level} />
                <Field
                  label="Persistence (s)"
                  value={influenceZone.basis?.persistence_seconds}
                />
                <Field
                  label="Neighbor Agreement"
                  value={influenceZone.basis?.neighbor_agreement_count}
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 pt-3 border-t border-slate-100 dark:border-navy-800">
                  Formula-based estimate, not an ML model — shown for
                  transparency, not as a guaranteed boundary.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500">
                No influence zone (node has no data or is GREY)
              </p>
            )}
          </Card>

          <Card title="Contributing Features">
            <ContributingFeatures features={risk?.contributing_features} />
          </Card>

          <Card title="Anomaly Detection">
            {anomalyError ? (
              <EndpointError message={anomalyError} />
            ) : anomaly ? (
              <>
                <Field label="Anomaly Score" value={anomaly.anomaly_score?.toFixed?.(3)} />
                <Field label="Status" value={anomaly.anomaly_status} />
                <Field
                  label="Detected"
                  value={anomaly.detected_at ? new Date(anomaly.detected_at).toLocaleString() : null}
                />
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-navy-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    Contributing Features
                  </p>
                  {/* AnomalyOut.contributing_features exists in the schema
                      (Optional[Dict[str, float]]) but is deliberately left
                      unpopulated by the backend for now (no ready-made
                      per-sample explainability for Isolation Forest, unlike
                      XGBoost). Rendered with the same component as risk's
                      contributing features so this improves automatically
                      once the backend populates it — no frontend change
                      needed then. */}
                  <ContributingFeatures features={anomaly.contributing_features} />
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500">No anomaly data yet</p>
            )}
          </Card>

          <Card title="Prediction" className="md:col-span-2">
            <div className="mb-3">
              <StatusTag status="predicted" />
            </div>
            {predictionError ? (
              <EndpointError message={predictionError} />
            ) : prediction ? (
              <>
                <Field
                  label="Predicted Displacement"
                  value={
                    prediction.predicted_displacement_mm != null
                      ? `${prediction.predicted_displacement_mm.toFixed(2)} mm`
                      : null
                  }
                />
                <Field label="Trend Direction" value={prediction.trend_direction} />
                <Field label="Horizon" value={`${prediction.horizon_hours} h`} />
                <Field
                  label="Confidence"
                  value={
                    prediction.confidence != null
                      ? `${(prediction.confidence * 100).toFixed(0)}%`
                      : null
                  }
                />
                <Field
                  label="Predicted At"
                  value={prediction.predicted_at ? new Date(prediction.predicted_at).toLocaleString() : null}
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 pt-3 border-t border-slate-100 dark:border-navy-800">
                  Synthetic-data model output — not a guarantee of real-world
                  accuracy. Decision support only.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500">
                No prediction available yet
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default NodeDetailsPage;
