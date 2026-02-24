import { success } from "@/lib/api-response";
import { getCurrentUserContextOptional } from "@/lib/current-user";

export async function GET() {
  const currentUser = await getCurrentUserContextOptional();
  if (!currentUser) {
    return success({
      isAuthenticated: false,
      userId: null,
      userName: null,
      role: "viewer",
      siteIds: [],
    });
  }

  return success({
    isAuthenticated: currentUser.isAuthenticated,
    userId: currentUser.userId,
    userName: currentUser.userName,
    role: currentUser.role,
    siteIds: currentUser.siteIds,
  });
}
