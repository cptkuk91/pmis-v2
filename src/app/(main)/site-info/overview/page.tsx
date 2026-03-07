"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type SiteData = {
  _id: string;
  siteCode: string;
  siteName: string;
  address: string;
  status: "active" | "completed" | "suspended";
  startDate: string;
  endDate: string;
  description: string;
  projectManager?: { name: string; email: string };
};

type HistoryRow = {
  _id: string;
  eventDate: string;
  title: string;
  description: string;
  category: string;
};

const SITE_ID_KEY = "pmis:siteId";

type SiteOverviewForm = {
  siteName: string;
  address: string;
  status: SiteData["status"];
  startDate: string;
  endDate: string;
  description: string;
};

function getSiteId() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SITE_ID_KEY) ?? "";
}

function normalizeDateInput(value?: string | null) {
  return value ? String(value).slice(0, 10) : "";
}

function toSiteForm(site: SiteData): SiteOverviewForm {
  return {
    siteName: site.siteName,
    address: site.address ?? "",
    status: site.status,
    startDate: normalizeDateInput(site.startDate),
    endDate: normalizeDateInput(site.endDate),
    description: site.description ?? "",
  };
}

const historyColumns: DataTableColumn<HistoryRow>[] = [
  {
    key: "eventDate",
    header: "일자",
    className: "w-28",
    render: (v) => (v ? new Date(v as string).toLocaleDateString("ko-KR") : "-"),
  },
  { key: "category", header: "구분", className: "w-24" },
  { key: "title", header: "제목" },
  { key: "description", header: "내용" },
];

export default function OverviewPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const canEditSite = useMemo(() => hasMinRole(user.role, "site_admin"), [user.role]);
  const canDeleteSite = useMemo(() => hasMinRole(user.role, "super_admin"), [user.role]);
  const [site, setSite] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState<boolean>(() => Boolean(getSiteId()));
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<SiteOverviewForm>({
    siteName: "",
    address: "",
    status: "active",
    startDate: "",
    endDate: "",
    description: "",
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  /* history */
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [histPage, setHistPage] = useState(1);
  const [histTotalPages, setHistTotalPages] = useState(1);
  const [showHistForm, setShowHistForm] = useState(false);
  const [histForm, setHistForm] = useState({ eventDate: "", title: "", description: "", category: "" });

  useEffect(() => {
    const siteId = getSiteId();
    if (!siteId) return;
    fetch(`/api/sites/${siteId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) {
          setSite(res.data);
          setForm(toSiteForm(res.data));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const fetchHistory = useCallback((p: number) => {
    const siteId = getSiteId();
    if (!siteId) return;
    fetch(`/api/sites/history?siteId=${siteId}&page=${p}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) {
          setHistory(res.data);
          setHistTotalPages(res.meta?.totalPages ?? 1);
        }
      });
  }, []);

  useEffect(() => { fetchHistory(histPage); }, [histPage, fetchHistory]);

  async function handleSave() {
    if (!canEditSite) {
      return;
    }
    const siteId = getSiteId();
    const res = await fetch(`/api/sites/${siteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (json.ok) {
      setSite(json.data);
      setForm(toSiteForm(json.data));
      setEditing(false);
    }
  }

  function closeDeleteModal() {
    if (isDeleting) {
      return;
    }
    setIsDeleteModalOpen(false);
  }

  async function handleDelete() {
    if (!canDeleteSite || !site) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/sites/${site._id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error ?? "현장 삭제 실패");
      }

      localStorage.removeItem(SITE_ID_KEY);
      document.cookie = "pmis_site_id=; path=/; max-age=0";
      setIsDeleteModalOpen(false);
      setSite(null);
      router.push("/system-admin/sites");
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleHistSubmit() {
    const siteId = getSiteId();
    const res = await fetch("/api/sites/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...histForm, siteId }),
    });
    const json = await res.json();
    if (json.ok) {
      setShowHistForm(false);
      setHistForm({ eventDate: "", title: "", description: "", category: "" });
      fetchHistory(1);
      setHistPage(1);
    }
  }

  if (loading) return <div className="p-6 text-sm text-foreground-muted">로딩 중...</div>;
  if (!site) return <div className="p-6 text-sm text-foreground-muted">현장을 선택해주세요.</div>;

  return (
    <section className="space-y-6">
      {/* ── 현장 개요 ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">현장 개요</h1>
        {!editing ? (
          <div className="flex items-center gap-2">
            {canEditSite ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]"
              >
                수정
              </button>
            ) : null}
            {canDeleteSite ? (
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="rounded-md border border-danger/40 bg-danger/10 px-4 py-1.5 text-sm font-medium text-danger hover:bg-danger/15"
              >
                삭제
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-border bg-background-card p-6">
        {editing ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">현장명</label>
              <input
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/15"
                value={form.siteName}
                onChange={(e) => setForm({ ...form, siteName: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">주소</label>
              <input
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/15"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-foreground">상태</label>
                <select
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/15"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as SiteData["status"] })}
                >
                  <option value="active">진행중</option>
                  <option value="completed">완료</option>
                  <option value="suspended">중지</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-foreground">착공일</label>
                <input
                  type="date"
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/15"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-foreground">준공일</label>
                <input
                  type="date"
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/15"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">설명</label>
              <textarea
                className="min-h-24 w-full rounded-md border border-border bg-background-card p-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/15"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => {
                  setForm(toSiteForm(site));
                  setEditing(false);
                }}
                className="rounded-md border border-border px-4 py-1.5 text-sm text-foreground hover:bg-background-soft"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]"
              >
                저장
              </button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <dt className="text-sm text-foreground-muted">현장코드</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{site.siteCode}</dd>
            </div>
            <div>
              <dt className="text-sm text-foreground-muted">현장명</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{site.siteName}</dd>
            </div>
            <div>
              <dt className="text-sm text-foreground-muted">주소</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{site.address || "-"}</dd>
            </div>
            <div>
              <dt className="text-sm text-foreground-muted">상태</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{site.status}</dd>
            </div>
            <div>
              <dt className="text-sm text-foreground-muted">착공일</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">
                {site.startDate ? new Date(site.startDate).toLocaleDateString("ko-KR") : "-"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-foreground-muted">준공일</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">
                {site.endDate ? new Date(site.endDate).toLocaleDateString("ko-KR") : "-"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-foreground-muted">현장소장</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">
                {site.projectManager?.name ?? "-"}
              </dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-sm text-foreground-muted">설명</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{site.description || "-"}</dd>
            </div>
          </dl>
        )}
      </div>

      {/* ── 프로젝트 연혁 ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">프로젝트 연혁</h2>
        <button
          type="button"
          onClick={() => setShowHistForm(!showHistForm)}
          className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]"
        >
          {showHistForm ? "취소" : "등록"}
        </button>
      </div>

      {showHistForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">일자</label>
              <input type="date" className="h-9 w-full rounded-md border border-border px-3 text-sm" value={histForm.eventDate} onChange={(e) => setHistForm({ ...histForm, eventDate: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">구분</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={histForm.category} onChange={(e) => setHistForm({ ...histForm, category: e.target.value })} placeholder="착공, 준공, 인허가 등" />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">제목</label>
              <input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={histForm.title} onChange={(e) => setHistForm({ ...histForm, title: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">내용</label>
            <textarea className="min-h-20 w-full rounded-md border border-border p-3 text-sm" value={histForm.description} onChange={(e) => setHistForm({ ...histForm, description: e.target.value })} />
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={handleHistSubmit} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">저장</button>
          </div>
        </div>
      )}

      <DataTable columns={historyColumns} data={history} rowKey={(row) => row._id} />
      {histTotalPages > 1 && <Pagination page={histPage} totalPages={histTotalPages} onPageChange={setHistPage} />}

      <Modal open={isDeleteModalOpen} title="현장 삭제 확인" onClose={closeDeleteModal}>
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-background-soft p-3">
            <p className="text-sm text-foreground">
              <span className="font-medium">{site?.siteCode}</span>
              {" · "}
              <span>{site?.siteName}</span>
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              삭제 후에는 현장 목록에서 제외되고, 연결된 활성 사용자 배정도 함께 비활성화됩니다.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={isDeleting}
              onClick={closeDeleteModal}
              className="rounded-md border border-border px-4 py-1.5 text-sm text-foreground hover:bg-background-soft disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => void handleDelete()}
              className="rounded-md border border-danger/40 bg-danger/10 px-4 py-1.5 text-sm font-medium text-danger hover:bg-danger/15 disabled:opacity-60"
            >
              {isDeleting ? "삭제 중..." : "삭제"}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
