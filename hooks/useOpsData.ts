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

  const load = async () => {
    try {
      setLoading(true);

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
    load();
  }, []);

  return {
    data,
    loading,
    error,
    refresh: load,
  };
}