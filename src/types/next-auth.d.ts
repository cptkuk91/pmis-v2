import type { DefaultSession } from "next-auth";
import type { Role } from "@/types";

declare module "next-auth" {
  interface User {
    id?: string;
    role?: Role;
    siteIds?: string[];
  }

  interface Session {
    user: DefaultSession["user"] & {
      id?: string;
      role: Role;
      siteIds: string[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    siteIds?: string[];
  }
}
