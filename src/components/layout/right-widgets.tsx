import { WeatherMiniWidget } from "@/components/layout/weather-mini-widget";

export function RightWidgets() {
  return (
    <aside className="hidden space-y-4 lg:block">
      <section className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
        <h3 className="mb-2 text-sm font-semibold text-foreground">금일회의</h3>
        <ul className="space-y-2 text-sm text-foreground-muted">
          <li>14:00 안전 점검 회의</li>
          <li>16:00 공정 조정 회의</li>
        </ul>
      </section>
      <section className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
        <h3 className="mb-2 text-sm font-semibold text-foreground">공지사항</h3>
        <p className="text-sm text-foreground-muted">신규 결재 대기 문서 3건</p>
      </section>
      <section className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
        <h3 className="mb-2 text-sm font-semibold text-foreground">날씨</h3>
        <WeatherMiniWidget />
      </section>
    </aside>
  );
}
