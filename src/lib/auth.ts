import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { Role } from "@/types";

const isProduction = process.env.NODE_ENV === "production";
const secureCookiePrefix = isProduction ? "__Secure-" : "";
const sharedCookieOptions = {
  sameSite: "lax" as const,
  path: "/",
  secure: isProduction,
};
const googleClientId = process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;

if (!googleClientId || !googleClientSecret) {
  throw new Error(
    "Google OAuth 설정이 없습니다. AUTH_GOOGLE_ID/SECRET 또는 GOOGLE_CLIENT_ID/SECRET을 설정하세요.",
  );
}

const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  cookies: {
    sessionToken: {
      name: `${secureCookiePrefix}pmis.authjs.session-token`,
      options: { ...sharedCookieOptions, httpOnly: true },
    },
    callbackUrl: {
      name: `${secureCookiePrefix}pmis.authjs.callback-url`,
      options: sharedCookieOptions,
    },
    csrfToken: {
      name: `${secureCookiePrefix}pmis.authjs.csrf-token`,
      options: { ...sharedCookieOptions, httpOnly: true },
    },
    pkceCodeVerifier: {
      name: `${secureCookiePrefix}pmis.authjs.pkce.code_verifier`,
      options: { ...sharedCookieOptions, httpOnly: true, maxAge: 60 * 15 },
    },
    state: {
      name: `${secureCookiePrefix}pmis.authjs.state`,
      options: { ...sharedCookieOptions, httpOnly: true, maxAge: 60 * 15 },
    },
    nonce: {
      name: `${secureCookiePrefix}pmis.authjs.nonce`,
      options: { ...sharedCookieOptions, httpOnly: true, maxAge: 60 * 15 },
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user.role as Role | undefined) ?? "viewer";
        token.siteIds = Array.isArray(user.siteIds) ? user.siteIds : [];
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role as Role | undefined) ?? "viewer";
        session.user.siteIds = Array.isArray(token.siteIds)
          ? token.siteIds.map(String)
          : [];
      }
      return session;
    },
  },
});

export const { GET, POST } = handlers;
export { auth, signIn, signOut };
