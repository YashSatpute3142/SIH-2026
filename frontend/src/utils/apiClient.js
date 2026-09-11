import { getToken, clearToken } from "./auth.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (networkError) {
    throw new ApiError("Network request failed", 0, null);
  }

  if (response.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new ApiError("Session expired", 401, null);
  }

  if (!response.ok) {
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    const message = body?.detail || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, body);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function apiGet(path, params) {
  let query = "";
  if (params) {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    );
    const search = new URLSearchParams(cleaned).toString();
    if (search) {
      query = `?${search}`;
    }
  }
  return request(`${path}${query}`, { method: "GET" });
}

export function apiPost(path, body) {
  return request(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Added for node mutations (PATCH /api/nodes/{node_id}) and any future
// partial-update endpoint — same request() plumbing as apiPost, just a
// different HTTP verb, so 401/error/204 handling stays identical.
export function apiPatch(path, body) {
  return request(path, {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Added for node deregistration (DELETE /api/nodes/{node_id}), which per the
// Chat 8 backend is a soft delete server-side (status -> "decommissioned")
// — this client function just issues the DELETE, no client-side special
// casing needed since the server already handles the soft-delete semantics.
export function apiDelete(path) {
  return request(path, { method: "DELETE" });
}

export { API_BASE_URL, ApiError };
