"use client";

import { useEffect, useState } from "react";

type ApiResponse<T> = {
  success: boolean;
  data: T;
  error?: string;
};

export function useOpsData<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (syncLive = false) => {
    try {
      setLoading(true);

      if (syncLive) {
        // The server deduplicates this across every open dashboard tab. A
        // failed source refresh does not discard the last successful snapshot.
        await fetch("/api/ops-data?live=1", { method: "POST", cache: "no-store" });
      }
      const res = await fetch("/api/ops-data", {
        cache: "no-store",
      });

      const json: ApiResponse<T> = await res.json();

      if (!json.success) {
        throw new Error(json.error || "Failed to load dashboard");
      }

      setData(json.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(true);
    const timer = window.setInterval(() => { void load(true); }, 45_000);
    return () => window.clearInterval(timer);
  }, []);

  return {
    data,
    loading,
    error,
    refresh: () => load(true),
  };
}
