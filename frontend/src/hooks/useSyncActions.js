import { useState, useCallback } from "react";
import { apiPost } from "../utils/apiClient.js";

// CONFIRMED against the real backend (sync.py): POST
// /api/sync/toggle-internet (body: { online: bool }) and POST
// /api/sync/trigger (no body). trigger's response shape (SyncTriggerResponse)
// wasn't shown to me beyond its import — process_pending_sync_queue's
// result dict is spread into it — so triggerSync's return value is handled
// defensively by the caller rather than assumed here.
export function useSyncActions(onSuccess) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const toggleInternet = useCallback(
    async (online) => {
      setIsSubmitting(true);
      setError(null);
      try {
        const result = await apiPost("/api/sync/toggle-internet", { online });
        onSuccess?.();
        return result;
      } catch (err) {
        setError(err.message || "Failed to toggle internet status");
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSuccess]
  );

  const triggerSync = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await apiPost("/api/sync/trigger");
      onSuccess?.();
      return result;
    } catch (err) {
      setError(err.message || "Failed to trigger sync");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [onSuccess]);

  return { toggleInternet, triggerSync, isSubmitting, error };
}

export default useSyncActions;
