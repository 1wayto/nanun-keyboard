import { useEffect, useState, useCallback } from "react";

// Reads CAD state from the dev-server endpoint and listens for HMR pushes.
// In production builds the HMR channel is absent, so we fall back to polling.
export function useCadState() {
  const [state, setState] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let pollTimer = null;

    async function refresh() {
      try {
        const r = await fetch("/__cad_state");
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) setState(j);
      } catch { /* ignore — endpoint may be missing in prod build */ }
    }

    refresh();

    // Vite HMR channel for dev-time pushes.
    if (import.meta.hot) {
      const handler = () => refresh();
      import.meta.hot.on("cad-state:changed", handler);
      return () => {
        cancelled = true;
        import.meta.hot.off("cad-state:changed", handler);
      };
    }

    // Production fallback — light polling.
    pollTimer = setInterval(refresh, 1500);
    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []);

  const setParam = useCallback(async (path, value) => {
    const r = await fetch("/__cad_state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, value }),
    });
    const j = await r.json();
    // The HMR push will refresh state shortly, but for snappier UI we set it now.
    if (j.ok && j.state) setState(j.state);
    return j;
  }, []);

  return { state, setParam };
}
