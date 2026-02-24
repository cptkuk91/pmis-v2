import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-lg rounded-xl border border-border bg-background-card p-8 shadow-[var(--shadow-soft)]">
        <h1 className="text-2xl font-bold text-danger">접근 권한이 없습니다</h1>
        <p className="mt-3 text-sm text-foreground-muted">
          현재 계정 역할로는 요청한 페이지에 접근할 수 없습니다. 관리자에게 권한을 요청하세요.
        </p>
        <div className="mt-6 flex gap-2">
          <Link
            href="/dashboard"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background-card hover:opacity-90"
          >
            대시보드로 이동
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
          >
            다시 로그인
          </Link>
        </div>
      </section>
    </main>
  );
}
