"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";

export type SiteMemberOption = {
  _id: string;
  name: string;
  email: string;
  role: string;
  membershipRole: string;
};

export function formatSiteMemberSummary(item: SiteMemberOption | null, fallbackName = ""): string {
  if (item) {
    return item.email ? `${item.name} · ${item.email}` : item.name;
  }
  return fallbackName;
}

export function findUniqueSiteMemberMatch(
  name: string,
  options: SiteMemberOption[],
): SiteMemberOption | null {
  const normalizedName = name.trim().toLowerCase();
  if (!normalizedName) {
    return null;
  }

  const matched = options.filter((item) => item.name.trim().toLowerCase() === normalizedName);
  return matched.length === 1 ? matched[0] : null;
}

export function useSiteMembers(enabled: boolean) {
  const [memberOptions, setMemberOptions] = useState<SiteMemberOption[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [isMemberLoading, setIsMemberLoading] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const deferredMemberQuery = useDeferredValue(memberQuery);

  const loadMembers = useCallback(async () => {
    if (!enabled) {
      setMemberOptions([]);
      setMemberError(null);
      return;
    }

    setIsMemberLoading(true);
    setMemberError(null);

    try {
      const response = await fetch("/api/sites/members", { cache: "no-store" });
      const result = (await response.json()) as {
        ok: boolean;
        data?: SiteMemberOption[];
        error?: string;
      };

      if (!result.ok) {
        throw new Error(result.error ?? "현장 배치 사용자 조회 실패");
      }

      setMemberOptions(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setMemberOptions([]);
      setMemberError(err instanceof Error ? err.message : "현장 배치 사용자 조회 실패");
    } finally {
      setIsMemberLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setMemberOptions([]);
      setMemberQuery("");
      setMemberError(null);
      return;
    }

    void loadMembers();
  }, [enabled, loadMembers]);

  const filteredMembers = useMemo(() => {
    const keyword = deferredMemberQuery.trim().toLowerCase();
    if (!keyword) {
      return memberOptions;
    }

    return memberOptions.filter((item) => {
      return (
        item.name.toLowerCase().includes(keyword) ||
        item.email.toLowerCase().includes(keyword) ||
        item.role.toLowerCase().includes(keyword) ||
        item.membershipRole.toLowerCase().includes(keyword)
      );
    });
  }, [deferredMemberQuery, memberOptions]);

  return {
    memberOptions,
    filteredMembers,
    memberQuery,
    setMemberQuery,
    isMemberLoading,
    memberError,
    loadMembers,
  };
}
