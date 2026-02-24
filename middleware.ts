import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Role } from "@/types";
import { isAuthBypassEnabled } from "@/lib/runtime-flags";

const roleOrder: Record<Role, number> = {
  viewer: 1,
  manager: 2,
  site_admin: 3,
  super_admin: 4,
};

const roleRules: Array<{ prefix: string; minRole: Role }> = [
  { prefix: "/system-admin/codes", minRole: "site_admin" },
  { prefix: "/design-docs/documents/categories", minRole: "site_admin" },
  { prefix: "/dashboard/pending-docs", minRole: "manager" },
];

const publicRoutes = new Set<string>(["/login", "/unauthorized"]);

function getMinRole(pathname: string): Role {
  const matchedRule = roleRules.find((rule) => pathname.startsWith(rule.prefix));
  return matchedRule?.minRole ?? "viewer";
}

function hasRole(userRole: Role, minRole: Role): boolean {
  return roleOrder[userRole] >= roleOrder[minRole];
}

function applySecurityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-XSS-Protection", "0");
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
  return response;
}

export default auth((req) => {
  const pathname = req.nextUrl.pathname;

  if (isAuthBypassEnabled) {
    return applySecurityHeaders(NextResponse.next());
  }

  if (publicRoutes.has(pathname)) {
    return applySecurityHeaders(NextResponse.next());
  }

  if (!req.auth?.user) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }

  const minRole = getMinRole(pathname);
  const userRole = (req.auth.user.role as Role | undefined) ?? "viewer";

  if (!hasRole(userRole, minRole)) {
    return applySecurityHeaders(
      NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin)),
    );
  }

  return applySecurityHeaders(NextResponse.next());
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
