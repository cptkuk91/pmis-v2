"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DataTable } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type WeatherRow = {
  _id: string;
  observedDate: string;
  condition: string;
  temperatureMin: number;
  temperatureMax: number;
  precipitationChance: number;
  windSpeed: number;
  warning: string;
  source: string;
};

type WeatherResponse = {
  ok: boolean;
  data: WeatherRow[];
  meta?: {
    provider?: "open-meteo" | "snapshot";
    reason?: string;
    siteName?: string;
    siteAddress?: string;
    resolvedAddress?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
  };
  error?: string;
};

export default function ProgressWeatherPage() {
  const { user } = useCurrentUser();
  const canManageSync = hasMinRole(user.role, "manager");

  const [items, setItems] = useState<WeatherRow[]>([]);
  const [days, setDays] = useState(7);
  const [provider, setProvider] = useState<string>("-");
  const [siteName, setSiteName] = useState<string>("-");
  const [siteAddress, setSiteAddress] = useState<string>("-");
  const [resolvedAddress, setResolvedAddress] = useState<string>("-");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (nextDays: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/progress/weather?days=${nextDays}`, { cache: "no-store" });
      const result = (await response.json()) as WeatherResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "현장 날씨 조회 실패");
      }
      setItems(result.data);
      setProvider(result.meta?.provider ?? "-");
      setSiteName(result.meta?.siteName || "-");
      setSiteAddress(result.meta?.siteAddress || "-");
      setResolvedAddress(result.meta?.resolvedAddress || "-");
    } catch (err) {
      setError(err instanceof Error ? err.message : "현장 날씨 조회 실패");
      setItems([]);
      setProvider("-");
      setSiteName("-");
      setSiteAddress("-");
      setResolvedAddress("-");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const runSync = useCallback(
    async (mode: "sync" | "retry") => {
      setIsSyncing(true);
      setError(null);
      setSyncMessage(null);
      try {
        const path =
          mode === "sync"
            ? "/api/integrations/open-meteo/sync"
            : "/api/integrations/open-meteo/retry-failed";

        const response = await fetch(path, { method: "POST" });
        const result = (await response.json()) as {
          ok: boolean;
          data?: { retried?: number; successCount?: number; failedCount?: number };
          error?: string;
        };
        if (!result.ok) {
          throw new Error(result.error ?? "동기화 실행 실패");
        }

        if (mode === "sync") {
          setSyncMessage("Open-Meteo 동기화가 완료되었습니다.");
        } else {
          const retried = Number(result.data?.retried ?? 0);
          const successCount = Number(result.data?.successCount ?? 0);
          const failedCount = Number(result.data?.failedCount ?? 0);
          setSyncMessage(`재시도 ${retried}건 중 성공 ${successCount}건, 실패 ${failedCount}건`);
        }

        await loadData(days);
      } catch (err) {
        setError(err instanceof Error ? err.message : "동기화 실행 실패");
      } finally {
        setIsSyncing(false);
      }
    },
    [days, loadData],
  );

  useEffect(() => {
    void loadData(days);
  }, [days, loadData]);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">현장 날씨</h1>
          <p className="mt-1 text-sm text-foreground-muted">현장 기온/강수/풍속을 조회하고 공정 영향도를 확인합니다.</p>
          <div className="mt-2 space-y-0.5 text-xs text-foreground-muted">
            <p>
              현장: {siteName} / 주소: {siteAddress}
            </p>
            <p>
              해석 위치: {resolvedAddress} / 출처: {provider}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-foreground-muted" htmlFor="days-select">
            기간
          </label>
          <select
            id="days-select"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="h-9 rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
          >
            <option value={7}>7일</option>
            <option value={14}>14일</option>
            <option value={30}>30일</option>
          </select>
          {canManageSync ? (
            <>
              <button
                type="button"
                onClick={() => void runSync("sync")}
                disabled={isSyncing}
                className="rounded-md border border-border bg-background-soft px-3 py-2 text-xs font-medium text-foreground hover:bg-background-card disabled:opacity-60"
              >
                동기화
              </button>
              <button
                type="button"
                onClick={() => void runSync("retry")}
                disabled={isSyncing}
                className="rounded-md border border-border bg-background-soft px-3 py-2 text-xs font-medium text-foreground hover:bg-background-card disabled:opacity-60"
              >
                실패 재시도
              </button>
            </>
          ) : null}
        </div>
      </header>

      {syncMessage ? <p className="text-sm text-success">{syncMessage}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.slice(0, 4).map((item) => (
          <div key={item._id} className="rounded-lg border border-border bg-background-soft p-4">
            <p className="text-xs text-foreground-muted">{new Date(item.observedDate).toLocaleDateString("ko-KR")}</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{item.condition}</p>
            <p className="mt-1 text-sm text-foreground-muted">
              {item.temperatureMin}°C / {item.temperatureMax}°C
            </p>
            <p className="mt-1 text-sm text-foreground-muted">강수확률 {item.precipitationChance}%</p>
            {item.warning ? <p className="mt-2 text-sm font-medium text-warning">{item.warning}</p> : null}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-background-soft p-4">
        <h2 className="text-sm font-semibold text-foreground">기온 추이</h2>
        <div className="mt-3 h-72 w-full">
          {items.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-foreground-muted">
              {isLoading ? "불러오는 중..." : "기상 데이터가 없습니다."}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={items} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e5e3" />
                <XAxis
                  dataKey="observedDate"
                  tickFormatter={(value) => String(value).slice(5, 10)}
                  tick={{ fontSize: 12, fill: "#787774" }}
                />
                <YAxis tick={{ fontSize: 12, fill: "#787774" }} />
                <Tooltip
                  labelFormatter={(label) => `일자 ${String(label).slice(0, 10)}`}
                  formatter={(value, name) => [`${Number(value ?? 0)}°C`, name]}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e6e5e3",
                    backgroundColor: "#ffffff",
                    color: "#37352f",
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="temperatureMin" name="최저기온" stroke="#245fb0" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="temperatureMax" name="최고기온" stroke="#c2413a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <DataTable<WeatherRow>
        columns={[
          {
            key: "observedDate",
            header: "일자",
            className: "w-28",
            render: (value) => new Date(String(value)).toLocaleDateString("ko-KR"),
          },
          { key: "condition", header: "기상", className: "w-20" },
          {
            key: "temperatureMin",
            header: "최저기온",
            className: "w-24 text-right",
            render: (value) => `${value}°C`,
          },
          {
            key: "temperatureMax",
            header: "최고기온",
            className: "w-24 text-right",
            render: (value) => `${value}°C`,
          },
          {
            key: "precipitationChance",
            header: "강수확률",
            className: "w-24 text-right",
            render: (value) => `${value}%`,
          },
          {
            key: "windSpeed",
            header: "풍속",
            className: "w-20 text-right",
            render: (value) => `${value}m/s`,
          },
          { key: "warning", header: "주의", className: "w-28" },
          { key: "source", header: "출처", className: "w-20" },
        ]}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "기상 데이터가 없습니다."}
      />
    </section>
  );
}
