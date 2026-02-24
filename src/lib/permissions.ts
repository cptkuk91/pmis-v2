import { FORBIDDEN, UNAUTHORIZED } from "@/lib/api-error";
import { getCurrentUserContextOptional } from "@/lib/current-user";
import type { Role } from "@/types";

export type AppRole = Role | "dev_bypass";

const roleOrder: Record<AppRole, number> = {
  viewer: 1,
  manager: 2,
  site_admin: 3,
  super_admin: 4,
  dev_bypass: 5,
};

export function hasMinimumRole(currentRole: AppRole, requiredRole: Role): boolean {
  return roleOrder[currentRole] >= roleOrder[requiredRole];
}

export async function requireRole(requiredRole: Role): Promise<{
  role: AppRole;
  userId: string | null;
  userName: string;
  email: string | null;
}> {
  const currentUser = await getCurrentUserContextOptional();
  if (!currentUser) {
    throw UNAUTHORIZED();
  }

  if (!currentUser.isActive) {
    throw FORBIDDEN();
  }

  if (!hasMinimumRole(currentUser.role, requiredRole)) {
    throw FORBIDDEN();
  }

  return {
    role: currentUser.role,
    userId: currentUser.userId,
    userName: currentUser.userName,
    email: currentUser.email,
  };
}
