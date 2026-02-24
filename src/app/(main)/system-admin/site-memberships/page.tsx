"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type MembershipRole = "site_admin" | "manager" | "viewer";

type SiteOption = {
  _id: string;
  siteCode: string;
  siteName: string;
  status: string;
};

type UserOption = {
  _id: string;
  name: string;
  email: string;
  role: string;
};

type MembershipRow = {
  _id: string;
  role: MembershipRole;
  isActive: boolean;
  assignedAt: string | null;
  revokedAt: string | null;
  site: {
    _id: string;
    siteCode: string;
    siteName: string;
  } | null;
  user: {
    _id: string;
    name: string;
    email: string;
    role: string;
  } | null;
};

type MembershipResponse = {
  ok: boolean;
  data: {
    memberships: MembershipRow[];
    sites: SiteOption[];
    users: UserOption[];
  };
  error?: string;
};

const roleOptions: Array<{ value: MembershipRole; label: string }> = [
  { value: "site_admin", label: "현장관리자" },
  { value: "manager", label: "관리자" },
  { value: "viewer", label: "조회자" },
];

type SiteViewMode = "all" | "unassigned" | string;

export default function SiteMembershipManagementPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canManage = useMemo(() => hasMinRole(user.role, "super_admin"), [user.role]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [sites, setSites] = useState<SiteOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [siteViewMode, setSiteViewMode] = useState<SiteViewMode>("all");
  const [inlineSiteByUser, setInlineSiteByUser] = useState<Record<string, string>>({});
  const [inlineRoleByUser, setInlineRoleByUser] = useState<Record<string, MembershipRole>>({});
  const [inlineAssigningUserId, setInlineAssigningUserId] = useState<string | null>(null);

  const [form, setForm] = useState<{
    siteId: string;
    userId: string;
    role: MembershipRole;
  }>({
    siteId: "all",
    userId: "",
    role: "viewer",
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const includeInactive = showInactive && siteViewMode !== "unassigned";
      const response = await fetch(
        `/api/system/site-memberships?includeInactive=${includeInactive ? "1" : "0"}`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as MembershipResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "현장 사용자 매핑 정보를 불러오지 못했습니다.");
      }

      setSites(Array.isArray(result.data.sites) ? result.data.sites : []);
      setUsers(Array.isArray(result.data.users) ? result.data.users : []);
      setMemberships(Array.isArray(result.data.memberships) ? result.data.memberships : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "현장 사용자 매핑 정보를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [showInactive, siteViewMode]);

  useEffect(() => {
    if (!isUserLoading && canManage) {
      void loadData();
    }
  }, [isUserLoading, canManage, loadData]);

  const normalizedUserQuery = userQuery.trim().toLowerCase();

  const filteredUsers = useMemo(() => {
    if (!normalizedUserQuery) {
      return [];
    }
    return users.filter(
      (item) =>
        item.name.toLowerCase().includes(normalizedUserQuery) ||
        item.email.toLowerCase().includes(normalizedUserQuery),
    );
  }, [users, normalizedUserQuery]);

  const selectedUser = useMemo(
    () => users.find((item) => item._id === form.userId) ?? null,
    [users, form.userId],
  );

  const activeMembershipUserIds = useMemo(() => {
    return new Set(
      memberships
        .filter((item) => item.isActive && item.user?._id)
        .map((item) => item.user!._id),
    );
  }, [memberships]);

  const unassignedUsers = useMemo(() => {
    return users.filter((item) => !activeMembershipUserIds.has(item._id));
  }, [users, activeMembershipUserIds]);

  const filteredMemberships = useMemo(() => {
    if (siteViewMode === "all" || siteViewMode === "unassigned") {
      return memberships;
    }
    return memberships.filter((item) => item.site?._id === siteViewMode);
  }, [memberships, siteViewMode]);

  const canAssignToSelectedSite = siteViewMode !== "all" && siteViewMode !== "unassigned";

  function userLabel(item: UserOption): string {
    return `${item.name} (${item.email})`;
  }

  function handleUserInputChange(value: string) {
    setUserQuery(value);
    if (selectedUser && value !== userLabel(selectedUser)) {
      setForm((prev) => ({ ...prev, userId: "" }));
    }
  }

  function handleSelectUser(item: UserOption) {
    setForm((prev) => ({ ...prev, userId: item._id }));
    setUserQuery(userLabel(item));
  }

  function handleSiteSelectionChange(value: string) {
    setSiteViewMode(value);
    setForm((prev) => ({ ...prev, siteId: value }));
  }

  function getInlineSite(userId: string): string {
    return inlineSiteByUser[userId] ?? "";
  }

  function getInlineRole(userId: string): MembershipRole {
    return inlineRoleByUser[userId] ?? "viewer";
  }

  async function handleAssign() {
    if (!canAssignToSelectedSite) {
      setError("배정 저장을 위해 특정 현장을 선택해 주세요.");
      return;
    }

    if (!form.siteId || !form.userId) {
      setError("현장과 사용자를 선택해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/system/site-memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "매핑 저장에 실패했습니다.");
      }

      setMessage("사용자-현장 매핑이 저장되었습니다.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "매핑 저장에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleChangeRole(membershipId: string, role: MembershipRole) {
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/system/site-memberships/${membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "권한 변경 실패");
      }
      setMessage("권한이 변경되었습니다.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "권한 변경 실패");
    }
  }

  async function handleToggleActive(membershipId: string, nextActive: boolean) {
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/system/site-memberships/${membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "상태 변경 실패");
      }
      setMessage(nextActive ? "매핑이 활성화되었습니다." : "매핑이 비활성화되었습니다.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "상태 변경 실패");
    }
  }

  async function handleInlineAssign(userId: string) {
    const siteId = getInlineSite(userId);
    const role = getInlineRole(userId);

    if (!siteId) {
      setError("배정할 현장을 선택해 주세요.");
      return;
    }

    setInlineAssigningUserId(userId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/system/site-memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, userId, role }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "즉시 배정 실패");
      }
      setMessage("사용자가 즉시 배정되었습니다.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "즉시 배정 실패");
    } finally {
      setInlineAssigningUserId(null);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)] sm:p-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">사용자-현장 매핑 관리</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          super_admin 권한으로 가입된 사용자만 현장에 배정할 수 있습니다.
        </p>
      </header>

      {!canManage ? (
        <div className="rounded-md border border-border bg-background-soft p-3 text-sm text-foreground-muted">
          현재 계정은 매핑 관리 권한(`super_admin`)이 없습니다.
        </div>
      ) : (
        <>
          <div className="space-y-3 rounded-md border border-border bg-background-soft p-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">현장 *</span>
                <select
                  value={siteViewMode}
                  onChange={(event) => handleSiteSelectionChange(event.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                >
                  <option value="all">전체 현장</option>
                  <option value="unassigned">현장 미배치</option>
                  {sites.map((site) => (
                    <option key={site._id} value={site._id}>
                      {site.siteCode} · {site.siteName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 md:col-span-1">
                <span className="block text-sm font-medium text-foreground">역할 *</span>
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, role: event.target.value as MembershipRole }))
                  }
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">사용자 *</span>
              <input
                value={userQuery}
                onChange={(event) => handleUserInputChange(event.target.value)}
                placeholder="이름 또는 이메일로 검색 후 아래에서 선택"
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              />
            </label>
            <div className="mt-1 space-y-2">
              {normalizedUserQuery ? (
                <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-background-card">
                  {filteredUsers.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-foreground-muted">검색 결과가 없습니다.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {filteredUsers.map((item) => {
                        const isSelected = form.userId === item._id;
                        return (
                          <li key={item._id}>
                            <button
                              type="button"
                              onClick={() => handleSelectUser(item)}
                              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                                isSelected ? "bg-background-soft text-foreground" : "text-foreground hover:bg-background-soft"
                              }`}
                            >
                              <span>{userLabel(item)}</span>
                              <span className="text-xs text-foreground-muted">{item.role}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="text-xs text-foreground-muted">검색어를 입력하면 사용자 목록이 표시됩니다.</p>
              )}
              {selectedUser ? (
                <p className="text-xs text-foreground-muted">
                  선택됨: {selectedUser.name} ({selectedUser.email}) · {selectedUser.role}
                </p>
              ) : null}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleAssign()}
                disabled={isSubmitting || !canAssignToSelectedSite}
                className="rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground hover:bg-background disabled:opacity-60"
              >
                매핑 저장
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground-muted">
              {siteViewMode === "unassigned"
                ? `현장 미배치 사용자 ${unassignedUsers.length}명`
                : `매핑 ${filteredMemberships.length}건`}
            </p>
            <div className="flex items-center gap-3">
              {siteViewMode !== "unassigned" ? (
                <label className="flex items-center gap-2 text-sm text-foreground-muted">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(event) => setShowInactive(event.target.checked)}
                  />
                  비활성 매핑 포함
                </label>
              ) : (
                <span className="text-xs text-foreground-muted">미배치 목록은 활성 매핑 기준으로 계산됩니다.</span>
              )}
            </div>
          </div>

          {siteViewMode === "unassigned" ? (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-background-soft text-left text-foreground-muted">
                  <tr>
                    <th className="px-3 py-2">사용자</th>
                    <th className="px-3 py-2">이메일</th>
                    <th className="px-3 py-2">앱 권한</th>
                    <th className="px-3 py-2">상태</th>
                    <th className="px-3 py-2">즉시 배정</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td className="px-3 py-3 text-foreground-muted" colSpan={5}>
                        사용자 목록 로딩 중...
                      </td>
                    </tr>
                  ) : unassignedUsers.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-foreground-muted" colSpan={5}>
                        현장 미배치 사용자가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    unassignedUsers.map((item) => (
                      <tr key={item._id} className="border-t border-border">
                        <td className="px-3 py-2 text-foreground">{item.name}</td>
                        <td className="px-3 py-2 text-foreground-muted">{item.email}</td>
                        <td className="px-3 py-2 text-foreground-muted">{item.role}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-foreground-muted">
                            미배치
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={getInlineSite(item._id)}
                              onChange={(event) =>
                                setInlineSiteByUser((prev) => ({ ...prev, [item._id]: event.target.value }))
                              }
                              className="h-8 min-w-[160px] rounded-md border border-border bg-background-card px-2 text-xs text-foreground"
                            >
                              <option value="">현장 없음</option>
                              {sites.map((site) => (
                                <option key={site._id} value={site._id}>
                                  {site.siteCode} · {site.siteName}
                                </option>
                              ))}
                            </select>
                            <select
                              value={getInlineRole(item._id)}
                              onChange={(event) =>
                                setInlineRoleByUser((prev) => ({
                                  ...prev,
                                  [item._id]: event.target.value as MembershipRole,
                                }))
                              }
                              className="h-8 min-w-[96px] rounded-md border border-border bg-background-card px-2 text-xs text-foreground"
                            >
                              {roleOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => void handleInlineAssign(item._id)}
                              disabled={!getInlineSite(item._id) || inlineAssigningUserId === item._id}
                              className="rounded-md border border-border bg-background-card px-2 py-1 text-xs text-foreground hover:bg-background disabled:opacity-60"
                            >
                              {inlineAssigningUserId === item._id ? "배정 중..." : "배정"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-background-soft text-left text-foreground-muted">
                  <tr>
                    <th className="px-3 py-2">현장</th>
                    <th className="px-3 py-2">사용자</th>
                    <th className="px-3 py-2">현재 권한</th>
                    <th className="px-3 py-2">배정일</th>
                    <th className="px-3 py-2">상태</th>
                    <th className="px-3 py-2">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td className="px-3 py-3 text-foreground-muted" colSpan={6}>
                        매핑 목록 로딩 중...
                      </td>
                    </tr>
                  ) : filteredMemberships.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-foreground-muted" colSpan={6}>
                        등록된 매핑이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredMemberships.map((item) => (
                      <tr key={item._id} className="border-t border-border">
                        <td className="px-3 py-2 text-foreground">
                          {item.isActive
                            ? (item.site ? `${item.site.siteCode} · ${item.site.siteName}` : "-")
                            : "현장 미배치"}
                        </td>
                        <td className="px-3 py-2 text-foreground">
                          {item.user ? (
                            <>
                              <div>{item.user.name}</div>
                              <div className="text-xs text-foreground-muted">{item.user.email}</div>
                            </>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={item.role}
                            onChange={(event) =>
                              void handleChangeRole(item._id, event.target.value as MembershipRole)
                            }
                            disabled={!item.isActive}
                            className="h-8 rounded-md border border-border bg-background-card px-2 text-xs text-foreground"
                          >
                            {roleOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-foreground-muted">
                          {item.assignedAt ? item.assignedAt.slice(0, 10) : "-"}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                              item.isActive
                                ? "bg-success/15 text-success"
                                : "bg-muted text-foreground-muted"
                            }`}
                          >
                            {item.isActive ? "활성" : "배정해제"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => void handleToggleActive(item._id, !item.isActive)}
                            className="rounded-md border border-border bg-background-card px-2 py-1 text-xs text-foreground hover:bg-background"
                          >
                            {item.isActive ? "배정 해제" : "재배정"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </section>
  );
}
