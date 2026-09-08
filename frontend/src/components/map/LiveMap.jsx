import { memo, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import useMapDataStore, {
  useZonesById,
  useNodesById,
  useNodeById,
  useRiskForNode,
  useMapDataActions,
  useMapDataError,
} from "../../store/mapDataStore.js";
import { useTheme } from "../../store/themeStore.js";

const RISK_LEVELS = {
  GREEN: { color: "#22c55e", label: "Green", icon: "\u2713" },
  YELLOW: { color: "#eab308", label: "Yellow", icon: "!" },
  ORANGE: { color: "#f97316", label: "Orange", icon: "\u203C" },
  RED: { color: "#ef4444", label: "Red", icon: "\u2715" },
  GREY: { color: "#6b7280", label: "No Data", icon: "?" },
};

const RISK_RANK = { GREEN: 0, YELLOW: 1, GREY: 1, ORANGE: 2, RED: 3 };

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const iconCache = {};

function getRiskIcon(riskLevel, dataSource) {
  const key = `${riskLevel}-${dataSource}`;
  if (iconCache[key]) return iconCache[key];

  const info = RISK_LEVELS[riskLevel] || RISK_LEVELS.GREY;
  const sourceLabel = dataSource === "real" ? "R" : "S";

  const html = `
    <div style="position:relative;width:28px;height:28px;">
      <div style="width:28px;height:28px;border-radius:9999px;background:${info.color};display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px rgba(15,23,42,0.8);">
        <span style="color:#0f172a;font-weight:700;font-size:13px;">${info.icon}</span>
      </div>
      <div style="position:absolute;top:-4px;right:-4px;width:14px;height:14px;border-radius:9999px;background:#0f172a;color:#e2e8f0;font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center;border:1px solid #334155;">${sourceLabel}</div>
    </div>
  `;

  const icon = L.divIcon({
    html,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });

  iconCache[key] = icon;
  return icon;
}

function resolveRiskLevel(node, risk) {
  if (!risk) return "GREY";
  if (node.status === "offline") return "GREY";
  return risk.risk_level in RISK_LEVELS ? risk.risk_level : "GREY";
}

function toFeature(boundaryGeojson) {
  if (!boundaryGeojson) return null;
  if (boundaryGeojson.type === "Feature") return boundaryGeojson;
  if (boundaryGeojson.type === "FeatureCollection") return boundaryGeojson;
  return { type: "Feature", geometry: boundaryGeojson, properties: {} };
}

const NodeMarker = memo(function NodeMarker({ nodeId }) {
  const node = useNodeById(nodeId);
  const risk = useRiskForNode(nodeId);

  if (!node) return null;

  const riskLevel = resolveRiskLevel(node, risk);
  const info = RISK_LEVELS[riskLevel];

  return (
    <Marker
      position={[node.latitude, node.longitude]}
      icon={getRiskIcon(riskLevel, node.data_source)}
    >
      <Popup>
        <div style={{ minWidth: "180px" }}>
          <p style={{ fontWeight: 700, marginBottom: "2px" }}>{node.node_id}</p>
          <p style={{ fontSize: "12px", color: "#475569", marginBottom: "6px" }}>
            {node.data_source === "real" ? "Real sensor" : "Simulated sensor"}
          </p>
          <p style={{ fontSize: "13px", marginBottom: "2px" }}>
            Risk: <strong style={{ color: info.color }}>{info.label}</strong>
          </p>
          {risk ? (
            <p style={{ fontSize: "12px", color: "#64748b" }}>
              Evaluated {new Date(risk.evaluated_at).toLocaleString()}
            </p>
          ) : (
            <p style={{ fontSize: "12px", color: "#64748b" }}>No risk evaluation yet</p>
          )}
        </div>
      </Popup>
    </Marker>
  );
});

function useZoneWorstRisk(zoneId) {
  const nodesById = useNodesById();
  const risksByNodeId = useMapDataStore((state) => state.risksByNodeId);

  return useMemo(() => {
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
  }, [nodesById, risksByNodeId, zoneId]);
}

function ZoneBoundary({ zone }) {
  const worstRisk = useZoneWorstRisk(zone.id);
  const feature = toFeature(zone.boundary_geojson);

  if (!feature) return null;

  const info = RISK_LEVELS[worstRisk];

  const style = {
    color: info.color,
    weight: 2,
    dashArray: worstRisk === "RED" || worstRisk === "ORANGE" ? "6 4" : null,
    fillColor: info.color,
    fillOpacity: 0.15,
  };

  return (
    <GeoJSON
      key={`${zone.id}-${worstRisk}`}
      data={feature}
      style={style}
      onEachFeature={(f, layer) => {
        layer.bindTooltip(`${zone.name} \u2014 ${info.label}`, { sticky: true });
      }}
    />
  );
}

const Legend = memo(function Legend() {
  return (
    <div className="absolute bottom-6 left-6 z-[1000] bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-4 py-3 shadow-lg">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Risk Level</p>
      <div className="space-y-1.5">
        {Object.entries(RISK_LEVELS).map(([key, info]) => (
          <div key={key} className="flex items-center gap-2">
            <span
              className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ backgroundColor: info.color, color: "#0f172a" }}
            >
              {info.icon}
            </span>
            <span className="text-xs text-slate-700 dark:text-slate-300">{info.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

function useMapCenter(nodesById) {
  return useMemo(() => {
    const nodes = Object.values(nodesById);
    if (nodes.length === 0) return [23.5, 85.3];
    const avgLat = nodes.reduce((sum, n) => sum + n.latitude, 0) / nodes.length;
    const avgLng = nodes.reduce((sum, n) => sum + n.longitude, 0) / nodes.length;
    return [avgLat, avgLng];
  }, [nodesById]);
}

function LiveMap() {
  const zonesById = useZonesById();
  const nodesById = useNodesById();
  const error = useMapDataError();
  const { startPolling, stopPolling } = useMapDataActions();
  const center = useMapCenter(nodesById);
  const theme = useTheme();

  const zoneIds = useMemo(() => Object.keys(zonesById), [zonesById]);
  const nodeIds = useMemo(() => Object.keys(nodesById), [nodesById]);

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const mapBackground = theme === "dark" ? "#0f172a" : "#f8fafc";

  return (
    <div className={`relative w-full h-full ${theme === "dark" ? "map-dark-tiles" : ""}`}>
      <style>{`
        .map-dark-tiles .leaflet-tile-pane {
          filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9);
        }
      `}</style>
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm px-4 py-2 rounded-lg">
          {error}
        </div>
      )}
      <MapContainer
        center={center}
        zoom={13}
        className="w-full h-full"
        style={{ background: mapBackground }}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        {zoneIds.map((id) => (
          <ZoneBoundary key={id} zone={zonesById[id]} />
        ))}
        {nodeIds.map((id) => (
          <NodeMarker key={id} nodeId={Number(id)} />
        ))}
      </MapContainer>
      <Legend />
    </div>
  );
}

export default LiveMap;
