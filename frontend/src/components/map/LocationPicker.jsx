import { useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "../../store/themeStore.js";
import { STREET_TILE_URL, STREET_TILE_ATTRIBUTION, DEFAULT_MAP_CENTER } from "../../utils/mapTiles.js";

// Lightweight click-to-pick-a-location map, used inside the node
// Add/Edit form. Deliberately street-tiles-only (no satellite toggle) to
// keep this contained — same tile source and dark-mode filter as LiveMap
// (via the shared mapTiles.js constants) so it visually matches the main
// map rather than feeling like a second, different-looking map bolted on.

const markerIconCache = { light: null, dark: null };

function getPickerIcon(theme) {
  if (markerIconCache[theme]) return markerIconCache[theme];

  const ringColor = theme === "dark" ? "rgba(7,10,17,0.85)" : "rgba(255,255,255,0.9)";

  const icon = L.divIcon({
    html: `
      <div style="width:22px;height:22px;border-radius:9999px;background:#0ea5e9;box-shadow:0 0 0 2px ${ringColor},0 2px 6px rgba(0,0,0,0.35);"></div>
    `,
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

  markerIconCache[theme] = icon;
  return icon;
}

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function LocationPicker({ latitude, longitude, onPick, defaultCenter, height = 240 }) {
  const theme = useTheme();

  const hasPosition = typeof latitude === "number" && typeof longitude === "number";
  const position = hasPosition ? [latitude, longitude] : null;
  const center = useMemo(
    () => position || defaultCenter || DEFAULT_MAP_CENTER,
    [position, defaultCenter]
  );

  const handlePick = useCallback(
    (lat, lng) => {
      onPick(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
    },
    [onPick]
  );

  return (
    <div
      className={`relative rounded-lg overflow-hidden border border-slate-200 dark:border-navy-650 ${
        theme === "dark" ? "map-dark-tiles" : ""
      }`}
      style={{ height }}
    >
      <style>{`
        .map-dark-tiles .leaflet-tile-pane {
          filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9);
        }
      `}</style>
      <MapContainer
        center={center}
        zoom={position ? 15 : 12}
        className="w-full h-full"
        style={{ background: theme === "dark" ? "#070a11" : "#f8fafc" }}
      >
        <TileLayer url={STREET_TILE_URL} attribution={STREET_TILE_ATTRIBUTION} />
        <ClickHandler onPick={handlePick} />
        {position && <Marker position={position} icon={getPickerIcon(theme)} />}
      </MapContainer>
      <div className="absolute bottom-2 left-2 z-[1000] bg-white/90 dark:bg-navy-850/90 backdrop-blur-sm text-[11px] text-slate-500 dark:text-slate-400 px-2 py-1 rounded-md pointer-events-none">
        Click the map to set coordinates
      </div>
    </div>
  );
}

export default LocationPicker;
