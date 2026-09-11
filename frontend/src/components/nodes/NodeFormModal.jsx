import { useState, useMemo, useCallback } from "react";
import LocationPicker from "../map/LocationPicker.jsx";

// Fixed 8-category sensor type set — matches the backend's SensorType
// Literal exactly (sensor_schemas.py). Hardcoded here deliberately: it's a
// closed enum on the backend, not something the frontend should treat as
// open-ended or fetch dynamically.
const SENSOR_TYPES = [
  "tilt",
  "displacement",
  "vibration",
  "crack",
  "temperature",
  "humidity",
  "battery",
  "rssi",
];

const DATA_SOURCES = [
  { value: "real", label: "Real" },
  { value: "simulated", label: "Simulated" },
];

function emptyFormState(node) {
  if (node) {
    return {
      node_id: node.node_id,
      node_name: node.node_name || "",
      zone_id: node.zone_id,
      data_source: node.data_source,
      sensor_types: node.sensor_types || [],
      latitude: node.latitude,
      longitude: node.longitude,
      is_reference_node: node.is_reference_node || false,
      calibration_status: node.calibration_status || "unknown",
    };
  }
  return {
    node_id: "",
    node_name: "",
    zone_id: "",
    data_source: "simulated",
    sensor_types: [],
    latitude: null,
    longitude: null,
    is_reference_node: false,
    calibration_status: "unknown",
  };
}

function FieldLabel({ children }) {
  return (
    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
      {children}
    </label>
  );
}

const inputClass =
  "w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-650 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed";

function NodeFormModal({ mode, node, zonesById, defaultCenter, isSubmitting, error, onSubmit, onClose }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState(() => emptyFormState(node));
  const [validationError, setValidationError] = useState(null);

  const zoneOptions = useMemo(
    () => Object.values(zonesById).sort((a, b) => a.name.localeCompare(b.name)),
    [zonesById]
  );

  const setField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleSensorType = useCallback((type) => {
    setForm((prev) => {
      const has = prev.sensor_types.includes(type);
      return {
        ...prev,
        sensor_types: has
          ? prev.sensor_types.filter((t) => t !== type)
          : [...prev.sensor_types, type],
      };
    });
  }, []);

  const handlePickLocation = useCallback(
    (lat, lng) => {
      setField("latitude", lat);
      setField("longitude", lng);
    },
    [setField]
  );

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setValidationError(null);

      if (!isEdit && !form.node_id.trim()) {
        setValidationError("Node ID is required.");
        return;
      }
      if (!form.zone_id) {
        setValidationError("Zone is required.");
        return;
      }
      if (
        typeof form.latitude !== "number" ||
        typeof form.longitude !== "number" ||
        form.latitude < -90 ||
        form.latitude > 90 ||
        form.longitude < -180 ||
        form.longitude > 180
      ) {
        setValidationError("Pick a valid location on the map (or enter coordinates).");
        return;
      }

      const payload = isEdit
        ? {
            node_name: form.node_name || null,
            zone_id: Number(form.zone_id),
            sensor_types: form.sensor_types.length ? form.sensor_types : null,
            latitude: form.latitude,
            longitude: form.longitude,
            is_reference_node: form.is_reference_node,
            calibration_status: form.calibration_status,
          }
        : {
            node_id: form.node_id.trim(),
            node_name: form.node_name || null,
            zone_id: Number(form.zone_id),
            data_source: form.data_source,
            sensor_types: form.sensor_types.length ? form.sensor_types : null,
            latitude: form.latitude,
            longitude: form.longitude,
            is_reference_node: form.is_reference_node,
            calibration_status: form.calibration_status,
          };

      try {
        await onSubmit(payload);
        onClose();
      } catch {
        // error state is surfaced via the `error` prop from useNodeMutations;
        // keep the modal open so the person can fix and resubmit.
      }
    },
    [form, isEdit, onSubmit, onClose]
  );

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-navy-850 border border-slate-200 dark:border-navy-650 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-650">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {isEdit ? "Edit Node" : "Add Node"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {(error || validationError) && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-2">
              {validationError || error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Node ID</FieldLabel>
              <input
                type="text"
                value={form.node_id}
                onChange={(e) => setField("node_id", e.target.value)}
                disabled={isEdit}
                placeholder="e.g. NODE-A-05"
                className={inputClass}
              />
              {isEdit && (
                <p className="text-[11px] text-slate-400 dark:text-slate-600 mt-1">
                  Immutable after registration
                </p>
              )}
            </div>
            <div>
              <FieldLabel>Node Name</FieldLabel>
              <input
                type="text"
                value={form.node_name}
                onChange={(e) => setField("node_name", e.target.value)}
                placeholder="Optional display name"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Zone</FieldLabel>
              <select
                value={form.zone_id}
                onChange={(e) => setField("zone_id", e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>
                  Select a zone
                </option>
                {zoneOptions.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Data Source</FieldLabel>
              <div className="flex gap-4 pt-2">
                {DATA_SOURCES.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-1.5 text-sm ${
                      isEdit ? "text-slate-400 dark:text-slate-600" : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="data_source"
                      value={opt.value}
                      checked={form.data_source === opt.value}
                      onChange={(e) => setField("data_source", e.target.value)}
                      disabled={isEdit}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              {isEdit && (
                <p className="text-[11px] text-slate-400 dark:text-slate-600 mt-1">
                  Immutable after registration
                </p>
              )}
            </div>
          </div>

          <div>
            <FieldLabel>Sensor Types</FieldLabel>
            <div className="grid grid-cols-4 gap-2">
              {SENSOR_TYPES.map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-650 rounded-lg px-2 py-1.5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={form.sensor_types.includes(type)}
                    onChange={() => toggleSensorType(type)}
                  />
                  <span className="capitalize">{type}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <FieldLabel>Location</FieldLabel>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <input
                type="number"
                step="any"
                value={form.latitude ?? ""}
                onChange={(e) => setField("latitude", e.target.value === "" ? null : Number(e.target.value))}
                placeholder="Latitude"
                className={inputClass}
              />
              <input
                type="number"
                step="any"
                value={form.longitude ?? ""}
                onChange={(e) => setField("longitude", e.target.value === "" ? null : Number(e.target.value))}
                placeholder="Longitude"
                className={inputClass}
              />
            </div>
            <LocationPicker
              latitude={form.latitude}
              longitude={form.longitude}
              onPick={handlePickLocation}
              defaultCenter={defaultCenter}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Calibration Status</FieldLabel>
              <input
                type="text"
                value={form.calibration_status}
                onChange={(e) => setField("calibration_status", e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.is_reference_node}
                  onChange={(e) => setField("is_reference_node", e.target.checked)}
                />
                Reference node
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Register Node"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NodeFormModal;
