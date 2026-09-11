import { useState, useEffect, useCallback, useRef } from "react";
import { apiGet } from "../utils/apiClient.js";

/**
 * Shared GET-resource hook: fetch/loading/error/refetch boilerplate in one place.
 * Resource-specific hooks (useAlerts, useInfluenceZones, useAnomalies, etc.)
 * become thin wrappers around this rather than reimplementing fetch lifecycles.
 *
 * @param {string|null} path - API path, e.g. "/api/alerts". Pass null to skip fetching.
 * @param {object} [options]
 * @param {object} [options.params] - query params, passed straight to apiGet.
 * @param {boolean} [options.enabled=true] - set false to skip fetching entirely.
 * @param {number} [options.pollIntervalMs] - if set, refetches on this interval.
 */
export function useApiResource(path, options = {}) {
  const { params, enabled = true, pollIntervalMs } = options;

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(enabled && !!path);
  const [error, setError] = useState(null);

  // Stable string key so effect deps don't churn on a new params object each render.
  const paramsKey = params ? JSON.stringify(params) : "";
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const fetchData = useCallback(async () => {
    if (!path || !enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiGet(path, paramsRef.current);
      setData(result);
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled, paramsKey]);

  useEffect(() => {
    fetchData();

    if (!pollIntervalMs || !enabled || !path) return undefined;

    const timer = setInterval(fetchData, pollIntervalMs);
    return () => clearInterval(timer);
  }, [fetchData, pollIntervalMs, enabled, path]);

  return { data, isLoading, error, refetch: fetchData };
}

export default useApiResource;
