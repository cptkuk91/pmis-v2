import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";

export default async function LoginPage() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-md rounded-xl border border-border bg-background-card p-8 shadow-[var(--shadow-soft)]">
        <h1 className="mb-2 text-2xl font-bold text-foreground">PMIS 로그인</h1>
        <p className="mb-6 text-sm text-foreground-muted">
          Google OAuth로 로그인 후 역할에 따라 접근 권한이 적용됩니다.
        </p>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background-card hover:opacity-90"
          >
            Google 계정으로 로그인
          </button>
        </form>

        <div className="mt-6 border-t border-border pt-4 text-xs text-foreground-muted">
          접근이 안 될 경우 <Link href="/unauthorized" className="underline">미인가 안내</Link>를
          확인하세요.
        </div>
      </section>
    </main>
  );
}
