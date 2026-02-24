"use client";

import { useEffect, useState } from "react";

export type ClientRole =
  | "viewer"
  | "manager"
  | "site_admin"
  | "super_admin"
  | "dev_bypass";

type CurrentUser = {
  isAuthenticated: boolean;
  userId: string | null;
  userName: string | null;
  email: string | null;
  role: ClientRole;
  siteIds?: string[];
};

const roleOrder: Record<ClientRole, number> = {
  viewer: 1,
  manager: 2,
  site_admin: 3,
  super_admin: 4,
  dev_bypass: 5,
};

export function hasMinRole(current: ClientRole, required: Exclude<ClientRole, "dev_bypass">): boolean {
  return roleOrder[current] >= roleOrder[required];
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser>({
    isAuthenticated: false,
    userId: null,
    userName: null,
    email: null,
    role: "viewer",
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch("/api/me", { cache: "no-store" });
        const result = (await response.json()) as { ok: boolean; data: CurrentUser };
        if (alive && result.ok) {
          setUser(result.data);
        }
      } finally {
        if (alive) {
          setIsLoading(false);
        }
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  return { user, isLoading };
}
