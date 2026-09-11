// Shared tile source constants — single source of truth so LiveMap and the
// new node-location picker always draw from the same tile providers instead
// of two copies that could silently drift apart.

export const STREET_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const STREET_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Esri World Imagery — free, no API key required. Note the {z}/{y}/{x} tile
// order, which is reversed from OSM's {z}/{x}/{y}.
export const SATELLITE_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const SATELLITE_TILE_ATTRIBUTION =
  "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";

// Fallback map center when no nodes exist yet to derive an average from.
export const DEFAULT_MAP_CENTER = [23.5, 85.3];
