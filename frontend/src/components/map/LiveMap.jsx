import { memo, useEffect, useMemo, useState, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  GeoJSON,
  Circle,
  Polyline,
  ZoomControl,
  ScaleControl,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import useMapDataStore, {
  useZonesById,
  useNodesById,
  useNodeById,
  useRiskForNode,
  useInfluenceZoneForNode,
  useMapDataActions,
  useMapDataError,
} from "../../store/mapDataStore.js";
import { useTheme } from "../../store/themeStore.js";
import { useNodePopupData } from "../../hooks/useNodePopupData.js";
import { RISK_LEVELS, resolveRiskLevel, getRiskColor, computeZoneWorstRisk } from "../../utils/riskLevels.js";
import {
  STREET_TILE_URL,
  STREET_TILE_ATTRIBUTION,
  SATELLITE_TILE_URL,
  SATELLITE_TILE_ATTRIBUTION,
  DEFAULT_MAP_CENTER,
} from "../../utils/mapTiles.js";

const DEFAULT_ZOOM = 15; // tighter default than the previous 13, per the reference look
const MESH_NEIGHBOR_COUNT = 2; // nearest-neighbor lines per node, visual only

// ---- Icon rendering (Leaflet-specific; risk color/label logic itself lives
// in the shared utils/riskLevels.js) ----------------------------------------

const iconCache = {};

function getRiskIcon(riskLevel, dataSource, theme) {
  const key = `${riskLevel}-${dataSource}-${theme}`;
  if (iconCache[key]) return iconCache[key];

  const info = RISK_LEVELS[riskLevel] || RISK_LEVELS.GREY;
  const color = getRiskColor(riskLevel, theme);
  const sourceLabel = dataSource === "real" ? "R" : "S";

  const ringColor = theme === "dark" ? "rgba(7,10,17,0.85)" : "rgba(255,255,255,0.9)";
  const badgeBg = theme === "dark" ? "#141a29" : "#0f172a";
  const badgeBorder = theme === "dark" ? "#2a3448" : "#334155";

  const html = `
    <div style="position:relative;width:28px;height:28px;">
      <div style="width:28px;height:28px;border-radius:9999px;background:${color};display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px ${ringColor},0 2px 6px rgba(0,0,0,0.35);">
        <span style="color:#0f172a;font-weight:700;font-size:13px;">${info.icon}</span>
      </div>
      <div style="position:absolute;top:-4px;right:-4px;width:14px;height:14px;border-radius:9999px;background:${badgeBg};color:#e2e8f0;font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center;border:1px solid ${badgeBorder};">${sourceLabel}</div>
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

function toFeature(boundaryGeojson) {
  if (!boundaryGeojson) return null;
  if (boundaryGeojson.type === "Feature") return boundaryGeojson;
  if (boundaryGeojson.type === "FeatureCollection") return boundaryGeojson;
  return { type: "Feature", geometry: boundaryGeojson, properties: {} };
}

// ---- Node marker + popup ----------------------------------------------

const NodeMarker = memo(function NodeMarker({ nodeId }) {
  const node = useNodeById(nodeId);
  const risk = useRiskForNode(nodeId);
  const theme = useTheme();
  // Influence zones are keyed by the string node_id, not the numeric id —
  // this hook takes node.node_id, not nodeId.
  const influenceZone = useInfluenceZoneForNode(node?.node_id);

  // Live reading data is fetched lazily, only while this marker's popup is
  // actually open — not on page load for every node. This is what keeps
  // richer popups from becoming an N+1 fetch problem across 9+ markers.
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const { latest: reading, isLoading: readingLoading, error: readingError } = useNodePopupData(
    node?.node_id,
    isPopupOpen
  );

  if (!node) return null;

  const riskLevel = resolveRiskLevel(node, risk);
  const info = RISK_LEVELS[riskLevel];
  const color = getRiskColor(riskLevel, theme);

  return (
    <Marker
      position={[node.latitude, node.longitude]}
      icon={getRiskIcon(riskLevel, node.data_source, theme)}
      eventHandlers={{
        popupopen: () => setIsPopupOpen(true),
        popupclose: () => setIsPopupOpen(false),
      }}
    >
      <Popup>
        <div className="min-w-[200px]">
          <p className="font-bold text-slate-900 dark:text-slate-100 mb-0.5">
            {node.node_name || node.node_id}
          </p>
          {node.node_name && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-1 font-mono">
              {node.node_id}
            </p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            {node.data_source === "real" ? "Real sensor" : "Simulated sensor"}
          </p>
          <p className="text-[13px] text-slate-700 dark:text-slate-300 mb-1">
            Risk:{" "}
            <strong style={{ color }}>
              {info.icon} {info.label}
            </strong>
          </p>
          {risk ? (
            <p className="text-xs text-slate-500 dark:text-slate-500 mb-1">
              Evaluated {new Date(risk.evaluated_at).toLocaleString()}
            </p>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-500 mb-1">
              No risk evaluation yet
            </p>
          )}
          {influenceZone && (
            <p className="text-xs text-slate-500 dark:text-slate-500 pt-1 mt-1 border-t border-slate-100 dark:border-navy-650">
              Influence radius: {Math.round(influenceZone.radius_m)} m
            </p>
          )}

          {/* Live raw reading — fetched only while this popup is open, from
              GET /api/nodes/{node_id}/readings/raw (limit 1). Not the
              /readings/latest endpoint, which only returns derived trend
              fields (tilt_rate, battery_trend, etc.), not raw instantaneous
              values — confirmed against the real reads.py router. */}
          <div className="pt-1.5 mt-1.5 border-t border-slate-100 dark:border-navy-650">
            {readingLoading ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">Loading readings...</p>
            ) : readingError ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {readingError.includes("404") || readingError.toLowerCase().includes("not found")
                  ? "No readings yet"
                  : readingError}
              </p>
            ) : reading ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                {reading.battery_voltage != null && (
                  <span>Battery: {reading.battery_voltage.toFixed(2)} V</span>
                )}
                {reading.tilt_magnitude != null && (
                  <span>Tilt: {reading.tilt_magnitude.toFixed(2)}°</span>
                )}
                {reading.displacement_mm != null && (
                  <span>Displacement: {reading.displacement_mm.toFixed(1)} mm</span>
                )}
                {reading.temperature != null && (
                  <span>Temp: {reading.temperature.toFixed(1)}°C</span>
                )}
                {reading.humidity != null && (
                  <span>Humidity: {reading.humidity.toFixed(0)}%</span>
                )}
                {reading.rssi != null && <span>RSSI: {reading.rssi} dBm</span>}
                <span className="col-span-2 text-slate-400 dark:text-slate-500 mt-0.5">
                  {new Date(reading.reading_timestamp).toLocaleString()}
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500">No readings yet</p>
            )}
          </div>
        </div>
      </Popup>
    </Marker>
  );
});

// ---- Heatmap-style influence zone (per node, from /api/influence-zones) --
// Leaflet's Circle only fills flat, so the "glow" is faked with several
// concentric, unstroked circles at decreasing radius / increasing opacity —
// same risk color throughout, just layered for a soft gradient look instead
// of a hard-edged disc. GREEN nodes still get a small zone per the approved
// formula (base 15m radius); at that size it naturally reads as a subtle
// dot rather than a dominant blob, no special-casing needed.
const GLOW_RINGS = [
  { fraction: 1.0, opacityDark: 0.05, opacityLight: 0.04 },
  { fraction: 0.72, opacityDark: 0.09, opacityLight: 0.07 },
  { fraction: 0.46, opacityDark: 0.16, opacityLight: 0.12 },
  { fraction: 0.22, opacityDark: 0.26, opacityLight: 0.2 },
];

const InfluenceZoneGlow = memo(function InfluenceZoneGlow({ nodeId }) {
  const node = useNodeById(nodeId);
  const theme = useTheme();
  const influenceZone = useInfluenceZoneForNode(node?.node_id);

  if (!node || !influenceZone) return null;

  const color = getRiskColor(influenceZone.risk_level, theme);
  const center = [influenceZone.center.lat, influenceZone.center.lon];

  return (
    <>
      {GLOW_RINGS.map((ring) => (
        <Circle
          key={ring.fraction}
          center={center}
          radius={influenceZone.radius_m * ring.fraction}
          pathOptions={{
            color: "transparent",
            weight: 0,
            fillColor: color,
            fillOpacity: theme === "dark" ? ring.opacityDark : ring.opacityLight,
          }}
          interactive={false}
        />
      ))}
    </>
  );
});

// ---- Zone administrative boundary (unchanged data source, restyled as an
// outline only — the new per-node glow above now carries the risk-intensity
// visualization, so the zone polygon no longer needs its own fill too) -----

function ZoneBoundary({ zone }) {
  const nodesById = useNodesById();
  const risksByNodeId = useMapDataStore((state) => state.risksByNodeId);
  const worstRisk = useMemo(
    () => computeZoneWorstRisk(zone.id, nodesById, risksByNodeId),
    [zone.id, nodesById, risksByNodeId]
  );
  const theme = useTheme();
  const feature = toFeature(zone.boundary_geojson);

  if (!feature) return null;

  const info = RISK_LEVELS[worstRisk];
  const color = getRiskColor(worstRisk, theme);

  const style = {
    color,
    weight: 2,
    dashArray: "6 5",
    fillOpacity: 0,
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

// ---- Nearest-neighbor mesh lines (visual only) -----------------------
// Purely spatial: each node connects to its MESH_NEIGHBOR_COUNT closest
// neighbors by distance. This is NOT derived from the backend's
// neighbor_agreement_count and does not imply any sensor-fusion relationship
// — it exists to give the map a network-topology feel, same as the
// reference layout. Labeled as such in the legend.

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function useMeshEdges(nodesById) {
  return useMemo(() => {
    const nodes = Object.values(nodesById);
    if (nodes.length < 2) return [];

    const edgeKeys = new Set();
    const edges = [];

    for (const node of nodes) {
      const distances = nodes
        .filter((other) => other.id !== node.id)
        .map((other) => ({ other, dist: haversineMeters(node, other) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, MESH_NEIGHBOR_COUNT);

      for (const { other } of distances) {
        const key = [node.id, other.id].sort((a, b) => a - b).join("-");
        if (edgeKeys.has(key)) continue;
        edgeKeys.add(key);
        edges.push({
          key,
          positions: [
            [node.latitude, node.longitude],
            [other.latitude, other.longitude],
          ],
        });
      }
    }

    return edges;
  }, [nodesById]);
}

const MeshLines = memo(function MeshLines({ edges }) {
  const theme = useTheme();
  const color = theme === "dark" ? "#38bdf8" : "#0284c7"; // accent-400 / accent-600

  return (
    <>
      {edges.map((edge) => (
        <Polyline
          key={edge.key}
          positions={edge.positions}
          pathOptions={{ color, weight: 1, opacity: theme === "dark" ? 0.3 : 0.35 }}
          interactive={false}
        />
      ))}
    </>
  );
});

// ---- Legend -------------------------------------------------------------

const Legend = memo(function Legend() {
  const theme = useTheme();

  return (
    <div className="absolute bottom-6 left-6 z-[1000] bg-white/95 dark:bg-navy-850/90 backdrop-blur-sm border border-slate-200 dark:border-navy-650 rounded-xl px-4 py-3 shadow-lg dark:shadow-2xl dark:shadow-black/40 max-w-[220px]">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Risk Level</p>
      <div className="space-y-1.5 mb-3">
        {Object.entries(RISK_LEVELS).map(([key, info]) => (
          <div key={key} className="flex items-center gap-2">
            <span
              className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
              style={{ backgroundColor: getRiskColor(key, theme), color: "#0f172a" }}
            >
              {info.icon}
            </span>
            <span className="text-xs text-slate-700 dark:text-slate-300">{info.label}</span>
          </div>
        ))}
      </div>
      <div className="pt-2 border-t border-slate-100 dark:border-navy-650 space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-4 h-0.5 bg-accent-500 dark:bg-accent-400 shrink-0" />
          <span className="text-[11px] text-slate-500 dark:text-slate-500">
            Nearby nodes (spatial only)
          </span>
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-600">
          Glow radius reflects risk, persistence &amp; neighbor agreement
        </p>
      </div>
    </div>
  );
});

// ---- Map view toggle (Street / Satellite) --------------------------------

const MapViewToggle = memo(function MapViewToggle({ mapView, onChange }) {
  return (
    <div className="inline-flex bg-white/95 dark:bg-navy-850/90 backdrop-blur-sm border border-slate-200 dark:border-navy-650 rounded-lg shadow-lg dark:shadow-2xl dark:shadow-black/40 overflow-hidden text-xs font-medium">
      {[
        { key: "street", label: "Street" },
        { key: "satellite", label: "Satellite" },
      ].map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`px-3 py-1.5 transition-colors ${
            mapView === opt.key
              ? "bg-accent-500 text-white"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
});

// ---- Compass (decorative, static — no bearing tracking) ------------------

const Compass = memo(function Compass() {
  return (
    <div
      className="w-9 h-9 flex items-center justify-center rounded-full bg-white/95 dark:bg-navy-850/90 backdrop-blur-sm border border-slate-200 dark:border-navy-650 shadow-lg dark:shadow-2xl dark:shadow-black/40 text-slate-600 dark:text-slate-300 text-xs font-bold"
      title="North"
    >
      N&uarr;
    </div>
  );
});

// ---- Search bar -----------------------------------------------------

const SearchBar = memo(function SearchBar({ nodesById, zonesById, onSelectNode }) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return Object.values(nodesById)
      .filter(
        (n) =>
          n.node_id.toLowerCase().includes(q) ||
          (n.node_name && n.node_name.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [query, nodesById]);

  const handleSelect = useCallback(
    (node) => {
      onSelectNode(node.id);
      setQuery("");
    },
    [onSelectNode]
  );

  return (
    <div className="relative w-72">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search node ID or name..."
        className="w-full bg-white/95 dark:bg-navy-850/90 backdrop-blur-sm border border-slate-200 dark:border-navy-650 rounded-lg shadow-lg dark:shadow-2xl dark:shadow-black/40 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
      />
      {matches.length > 0 && (
        <div className="absolute mt-1 w-full bg-white dark:bg-navy-850 border border-slate-200 dark:border-navy-650 rounded-lg shadow-xl overflow-hidden">
          {matches.map((node) => (
            <button
              key={node.id}
              onClick={() => handleSelect(node)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            >
              <span className="text-slate-800 dark:text-slate-200">
                {node.node_name || node.node_id}
              </span>
              {node.node_name && (
                <span className="text-slate-400 dark:text-slate-500 text-xs ml-1.5 font-mono">
                  {node.node_id}
                </span>
              )}
              <span className="text-slate-400 dark:text-slate-500 text-xs ml-1.5">
                &middot; {zonesById[node.zone_id]?.name || `Zone ${node.zone_id}`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

// Lives inside MapContainer to get access to the map instance via useMap().
function FlyToController({ targetNodeId, nodesById, onDone }) {
  const map = useMap();

  useEffect(() => {
    if (targetNodeId == null) return;
    const node = nodesById[targetNodeId];
    if (node) {
      map.flyTo([node.latitude, node.longitude], 17, { duration: 1.2 });
    }
    onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetNodeId]);

  return null;
}

// ---- Map center / view helpers -------------------------------------

function useMapCenter(nodesById) {
  return useMemo(() => {
    const nodes = Object.values(nodesById);
    if (nodes.length === 0) return DEFAULT_MAP_CENTER;
    const avgLat = nodes.reduce((sum, n) => sum + n.latitude, 0) / nodes.length;
    const avgLng = nodes.reduce((sum, n) => sum + n.longitude, 0) / nodes.length;
    return [avgLat, avgLng];
  }, [nodesById]);
}

// scopeToZoneId is optional — when provided, this same component renders as
// a mini-map limited to one zone's nodes (used by ZoneDetailsPage) instead
// of building a second map component. Default (no prop) behaves exactly as
// before: full mine-wide map. NodeMarker/InfluenceZoneGlow/ZoneBoundary
// themselves need no changes — they already select their own data by id
// from the store, scoping only changes which ids get iterated over here.
function LiveMap({ scopeToZoneId = null }) {
  const allZonesById = useZonesById();
  const allNodesById = useNodesById();
  const error = useMapDataError();
  const { startPolling, stopPolling } = useMapDataActions();
  const theme = useTheme();
  const [mapView, setMapView] = useState("street");
  const [flyToTarget, setFlyToTarget] = useState(null);

  const zonesById = useMemo(() => {
    if (scopeToZoneId == null) return allZonesById;
    return Object.fromEntries(
      Object.entries(allZonesById).filter(([, z]) => z.id === scopeToZoneId)
    );
  }, [allZonesById, scopeToZoneId]);

  const nodesById = useMemo(() => {
    if (scopeToZoneId == null) return allNodesById;
    return Object.fromEntries(
      Object.entries(allNodesById).filter(([, n]) => n.zone_id === scopeToZoneId)
    );
  }, [allNodesById, scopeToZoneId]);

  const center = useMapCenter(nodesById);

  const zoneIds = useMemo(() => Object.keys(zonesById), [zonesById]);
  const nodeIds = useMemo(() => Object.keys(nodesById), [nodesById]);
  const meshEdges = useMeshEdges(nodesById);

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const isStreet = mapView === "street";
  const tileFilterClass = isStreet
    ? theme === "dark"
      ? "map-dark-tiles"
      : ""
    : theme === "dark"
    ? "map-dark-satellite"
    : "";

  const mapBackground = theme === "dark" ? "#070a11" : "#f8fafc";

  return (
    <div className={`relative w-full h-full ${tileFilterClass}`}>
      <style>{`
        .map-dark-tiles .leaflet-tile-pane {
          filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9);
        }
        .map-dark-satellite .leaflet-tile-pane {
          filter: brightness(0.75) contrast(1.15) saturate(1.1);
        }
        .dark .leaflet-popup-content-wrapper {
          background: #141a29;
          color: #e2e8f0;
          border: 1px solid #2a3448;
          box-shadow: 0 8px 24px rgba(0,0,0,0.45);
        }
        .dark .leaflet-popup-tip {
          background: #141a29;
        }
        .dark .leaflet-popup-close-button {
          color: #94a3b8;
        }
        .dark .leaflet-popup-close-button:hover {
          color: #e2e8f0;
        }
        .leaflet-control-scale-line {
          background: rgba(255,255,255,0.85);
        }
        .dark .leaflet-control-scale-line {
          background: rgba(20,26,41,0.85);
          border-color: #2a3448 !important;
          color: #cbd5e1;
        }
      `}</style>

      {/* Top-left: search */}
      <div className="absolute top-4 left-4 z-[1000]">
        <SearchBar nodesById={nodesById} zonesById={zonesById} onSelectNode={setFlyToTarget} />
      </div>

      {/* Top-right: view toggle + compass */}
      <div className="absolute top-4 right-4 z-[1000] flex items-start gap-2">
        <MapViewToggle mapView={mapView} onChange={setMapView} />
        <Compass />
      </div>

      {error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      <MapContainer
        center={center}
        zoom={scopeToZoneId != null ? 16 : DEFAULT_ZOOM}
        className="w-full h-full"
        style={{ background: mapBackground }}
        zoomControl={false}
      >
        <TileLayer
          url={isStreet ? STREET_TILE_URL : SATELLITE_TILE_URL}
          attribution={isStreet ? STREET_TILE_ATTRIBUTION : SATELLITE_TILE_ATTRIBUTION}
        />
        {zoneIds.map((id) => (
          <ZoneBoundary key={id} zone={zonesById[id]} />
        ))}
        {nodeIds.map((id) => (
          <InfluenceZoneGlow key={`glow-${id}`} nodeId={Number(id)} />
        ))}
        <MeshLines edges={meshEdges} />
        {nodeIds.map((id) => (
          <NodeMarker key={id} nodeId={Number(id)} />
        ))}
        <FlyToController
          targetNodeId={flyToTarget}
          nodesById={nodesById}
          onDone={() => setFlyToTarget(null)}
        />
        <ZoomControl position="bottomright" />
        <ScaleControl position="bottomright" imperial={false} />
      </MapContainer>

      {theme === "dark" && (
        <div
          className="absolute inset-0 z-[450] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 55%, rgba(7,10,17,0.35) 100%)",
          }}
        />
      )}

      <Legend />
    </div>
  );
}

export default LiveMap;
