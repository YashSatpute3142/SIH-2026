import { useState, useCallback } from "react";
import { apiPost } from "../utils/apiClient.js";

// CONFIRMED against the real backend (alerts.py): POST
// /api/alerts/{id}/acknowledge and /api/alerts/{id}/resolve — path guesses
// were correct. AlertAcknowledgeRequest's field is `notes` (plural) — an
// earlier version of this hook sent `note` (singular), which the backend
// would have silently ignored as an unrecognized field, leaving notes
// always null.
export function useAlertActions(onSuccess) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const acknowledge = useCallback(
    async (alertId, notes) => {
      setIsSubmitting(true);
      setError(null);
      try {
        const result = await apiPost(`/api/alerts/${alertId}/acknowledge`, { notes: notes || null });
        onSuccess?.();
        return result;
      } catch (err) {
        setError(err.message || "Failed to acknowledge alert");
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSuccess]
  );

  const resolve = useCallback(
    async (alertId) => {
      setIsSubmitting(true);
      setError(null);
      try {
        const result = await apiPost(`/api/alerts/${alertId}/resolve`);
        onSuccess?.();
        return result;
      } catch (err) {
        setError(err.message || "Failed to resolve alert");
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSuccess]
  );

  return { acknowledge, resolve, isSubmitting, error };
}

export default useAlertActions;
