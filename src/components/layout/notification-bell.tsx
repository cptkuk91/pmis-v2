"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type NotificationSeverity = "info" | "warning" | "danger";

type NotificationItem = {
  id: string;
  type: "document" | "drawing_review" | "issue" | "weather" | "sync";
  severity: NotificationSeverity;
  title: string;
  message: string;
  href: string;
  timestamp: string;
};

type NotificationResponse = {
  ok: boolean;
  data: {
    summary: {
      unreadCount: number;
      pendingDocs?: number;
      pendingDrawingReviews?: number;
      openIssues?: number;
      weatherWarnings?: number;
      failedSyncJobs?: number;
      siteName?: string;
    };
    items: NotificationItem[];
  };
  error?: string;
};

const severityClass: Record<NotificationSeverity, string> = {
  info: "border-[#dbe9ff] bg-[#f4f8ff] text-[#245fb0]",
  warning: "border-[#f0e4d0] bg-[#fff9ef] text-[#8d651f]",
  danger: "border-[#f3d6d6] bg-[#fff5f5] text-[#9f2d2d]",
};

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [siteName, setSiteName] = useState("현장");
  const [items, setItems] = useState<NotificationItem[]>([]);

  const boxRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const result = (await response.json()) as NotificationResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "알림 조회 실패");
      }

      setUnreadCount(result.data.summary.unreadCount ?? 0);
      setSiteName(result.data.summary.siteName || "현장");
      setItems(result.data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알림 조회 실패");
      setUnreadCount(0);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!boxRef.current) {
        return;
      }
      if (!boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const badgeLabel = useMemo(() => {
    if (unreadCount > 99) {
      return "99+";
    }
    return String(unreadCount);
  }, [unreadCount]);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-md border border-border bg-background-soft px-2 py-1 text-xs text-foreground hover:bg-background-card"
        aria-label="알림"
      >
        알림
        {unreadCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
            {badgeLabel}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-[360px] rounded-lg border border-border bg-background-card p-3 shadow-[0_16px_32px_rgba(15,23,42,0.12)]">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">알림</h3>
            <span className="text-xs text-foreground-muted">{siteName}</span>
          </div>

          {error ? <p className="text-xs text-danger">{error}</p> : null}

          {isLoading ? (
            <p className="text-xs text-foreground-muted">불러오는 중...</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-foreground-muted">새 알림이 없습니다.</p>
          ) : (
            <ul className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`block rounded-md border px-2.5 py-2 text-xs transition ${severityClass[item.severity]}`}
                  >
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-0.5 line-clamp-2">{item.message}</p>
                    <p className="mt-1 text-[11px] opacity-80">{formatTimestamp(item.timestamp)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
