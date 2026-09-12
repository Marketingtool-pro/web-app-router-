import { useState, useEffect, useCallback } from "react";
import { fetchDashboardSummary, fetchConnectedAccounts } from "@/utils/api/windmill";
import { useAuth } from "@/contexts/AuthContext";

let cachedData = null;
let cacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

export default function useDashboardData() {
  const { user } = useAuth();
  const [data, setData] = useState(cachedData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDashboardSummary();
      if (result && typeof result === "object") {
        cachedData = result;
        cacheTime = Date.now();
        setData(result);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Ask the backend whether ad accounts are connected. This used to read
    // localStorage("fb_ads_connected"), which is per-browser and Facebook-only:
    // a customer who connected Google Ads, or who opened the app on a second
    // device, saw an empty dashboard forever because the flag was absent.
    // f/tools/fetch-connected-accounts is the same source Command Centre,
    // Campaigns and Profile already use.
    const userId = user?.$id || user?.id;
    if (!userId) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetchConnectedAccounts({ userId });
        const accounts = Array.isArray(res) ? res : res?.accounts || [];
        if (cancelled) return;
        if (accounts.length > 0 && (!cachedData || Date.now() - cacheTime > CACHE_TTL)) {
          refresh();
        }
      } catch {
        /* leave the dashboard showing zeros rather than guessing */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh, user]);

  const hasData = data?.hasData === true;

  return { data, loading, error, hasData, refresh };
}
