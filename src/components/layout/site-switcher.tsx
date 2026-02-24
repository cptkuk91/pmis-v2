"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

const STORAGE_KEY = "pmis:siteId";

type SiteOption = {
  _id: string;
  siteCode: string;
  siteName: string;
};

type SitesResponse = {
  ok: boolean;
  data: SiteOption[];
  error?: string;
};

function setSiteCookie(siteId: string): void {
  document.cookie = `pmis_site_id=${siteId}; path=/; max-age=${60 * 60 * 24 * 30}`;
}

function getCookieSiteId(): string | null {
  const match = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("pmis_site_id="));
  if (!match) {
    return null;
  }
  const [, value] = match.split("=");
  return value || null;
}

function resolveInitialSiteId(sites: SiteOption[]): string {
  const fromStorage = window.localStorage.getItem(STORAGE_KEY);
  if (fromStorage && sites.some((site) => site._id === fromStorage)) {
    return fromStorage;
  }

  const fromCookie = getCookieSiteId();
  if (fromCookie && sites.some((site) => site._id === fromCookie)) {
    return fromCookie;
  }

  return sites[0]?._id ?? "";
}

export function SiteSwitcher() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canManageSites = useMemo(() => hasMinRole(user.role, "super_admin"), [user.role]);

  useEffect(() => {
    let alive = true;

    async function loadSites() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/sites", { cache: "no-store" });
        const result = (await response.json()) as SitesResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "현장 목록 조회 실패");
        }

        if (!alive) {
          return;
        }

        const loadedSites = Array.isArray(result.data) ? result.data : [];
        setSites(loadedSites);

        if (!loadedSites.length) {
          setSelectedSiteId("");
          window.localStorage.removeItem(STORAGE_KEY);
          return;
        }

        const initialSiteId = resolveInitialSiteId(loadedSites);
        setSelectedSiteId(initialSiteId);
        window.localStorage.setItem(STORAGE_KEY, initialSiteId);
        setSiteCookie(initialSiteId);
      } catch (err) {
        if (!alive) {
          return;
        }
        setError(err instanceof Error ? err.message : "현장 목록 조회 실패");
      } finally {
        if (alive) {
          setIsLoading(false);
        }
      }
    }

    void loadSites();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedSiteId) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, selectedSiteId);
    setSiteCookie(selectedSiteId);
  }, [selectedSiteId]);

  const selectedSite = sites.find((site) => site._id === selectedSiteId) ?? null;

  function handleSiteChange(siteId: string) {
    setSelectedSiteId(siteId);
    setSiteCookie(siteId);
    window.localStorage.setItem(STORAGE_KEY, siteId);
    setIsModalOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        disabled={isLoading}
        className="rounded-md border border-border bg-background-soft px-3 py-1 text-xs font-medium text-foreground hover:bg-background-card disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading
          ? "현장 로딩..."
          : selectedSite
            ? `${selectedSite.siteCode} · ${selectedSite.siteName}`
            : "현장 없음"}
      </button>

      <Modal open={isModalOpen} title="현장 전환" onClose={() => setIsModalOpen(false)}>
        {isLoading ? (
          <p className="text-sm text-foreground-muted">현장 목록을 불러오는 중입니다.</p>
        ) : null}

        {!isLoading && sites.length > 0 ? (
          <ul className="space-y-2">
            {sites.map((site) => (
              <li key={site._id}>
                <button
                  type="button"
                  onClick={() => handleSiteChange(site._id)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                    site._id === selectedSiteId
                      ? "border-border-strong bg-background-soft text-foreground"
                      : "border-border text-foreground hover:bg-background-soft"
                  }`}
                >
                  <div className="font-medium">{site.siteCode}</div>
                  <div className="text-xs text-foreground-muted">{site.siteName}</div>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {!isLoading && sites.length === 0 ? (
          <div className="space-y-3 rounded-md border border-border bg-background-soft p-3">
            <p className="text-sm text-foreground">등록된 현장이 없습니다.</p>
            <p className="text-xs text-foreground-muted">
              최고 관리자 권한으로 현장을 먼저 생성해야 합니다.
            </p>
            {canManageSites ? (
              <Link
                href="/system-admin/sites"
                onClick={() => setIsModalOpen(false)}
                className="inline-flex rounded-md border border-border bg-background-card px-3 py-2 text-xs text-foreground hover:bg-background"
              >
                현장 등록 화면으로 이동
              </Link>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      </Modal>
    </>
  );
}
