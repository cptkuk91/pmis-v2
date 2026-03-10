"use client";

import { useCallback, useEffect, useState } from "react";

type WeatherRow = {
  _id: string;
  observedDate: string;
  condition: string;
  temperatureMin: number;
  temperatureMax: number;
  precipitationChance: number;
  warning: string;
};

type WeatherResponse = {
  ok: boolean;
  data: WeatherRow[];
  meta?: {
    provider?: "open-meteo" | "snapshot";
    siteName?: string;
  };
  error?: string;
};

export function WeatherMiniWidget() {
  const [today, setToday] = useState<WeatherRow | null>(null);
  const [siteName, setSiteName] = useState("현장");
  const [provider, setProvider] = useState("-");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);

    try {
      const response = await fetch("/api/progress/weather?days=1", { cache: "no-store" });
      const result = (await response.json()) as WeatherResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "날씨 조회 실패");
      }

      setToday(result.data[0] ?? null);
      setSiteName(result.meta?.siteName || "현장");
      setProvider(result.meta?.provider || "-");
    } catch (err) {
      setToday(null);
      setError(err instanceof Error ? err.message : "날씨 조회 실패");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return <p className="text-sm text-danger">{error}</p>;
  }

  if (!today) {
    return <p className="text-sm text-foreground-muted">날씨 정보를 불러오는 중...</p>;
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-foreground-muted">{siteName}</p>
      <p className="text-sm font-semibold text-foreground">{today.condition}</p>
      <p className="text-sm text-foreground-muted">
        {today.temperatureMin}℃ / {today.temperatureMax}℃
      </p>
      <p className="text-xs text-foreground-muted">강수확률 {today.precipitationChance}%</p>
      {today.warning ? <p className="text-xs font-medium text-warning">{today.warning}</p> : null}
      <p className="text-[11px] text-foreground-muted">출처: {provider}</p>
    </div>
  );
}
