import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAuthBypassEnabled } from "@/lib/runtime-flags";
import { getCurrentUserContextOptional } from "@/lib/current-user";
import { TopBar } from "@/components/layout/top-bar";
import { TopNav } from "@/components/layout/top-nav";
import { SideBar } from "@/components/layout/side-bar";
import { RightWidgets } from "@/components/layout/right-widgets";
import { Footer } from "@/components/layout/footer";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user && !isAuthBypassEnabled) {
    redirect("/login");
  }

  const currentUser = await getCurrentUserContextOptional();
  const userName =
    currentUser?.userName ?? session?.user?.name ?? (isAuthBypassEnabled ? "개발 게스트" : "사용자");
  const role = currentUser?.role ?? session?.user?.role ?? (isAuthBypassEnabled ? "dev_bypass" : "viewer");
  const isAuthenticated = Boolean(session?.user);

  return (
    <div className="min-h-screen bg-background">
      <TopBar userName={userName} role={role} isAuthenticated={isAuthenticated} />
      <TopNav />
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[240px_1fr_280px]">
        <div className="order-2 lg:order-1">
          <SideBar />
        </div>
        <main className="order-1 min-h-[calc(100vh-170px)] lg:order-2">{children}</main>
        <div className="order-3">
          <RightWidgets />
        </div>
      </div>
      <Footer />
    </div>
  );
}
