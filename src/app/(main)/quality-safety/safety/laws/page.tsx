"use client";

import { useEffect, useState, useCallback } from "react";

type LinkItem = { _id: string; title: string; url: string; description: string; sortOrder: number };
const SITE_ID_KEY = "pmis:siteId";

export default function SafetyLawsPage() {
  const [data, setData] = useState<LinkItem[]>([]);

  const fetchData = useCallback(() => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/safety/laws?siteId=${siteId}`)
      .then((r) => r.json())
      .then((res) => { if (res.ok) setData(res.data); });
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">안전법규</h1>
      {data.length === 0 ? (
        <p className="text-sm text-foreground-muted">등록된 안전법규 링크가 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {data.map((item) => (
            <a key={item._id} href={item.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-border bg-background-card p-4 transition-colors hover:bg-background-soft">
              <h3 className="font-medium text-foreground">{item.title}</h3>
              {item.description && <p className="mt-1 text-sm text-foreground-muted">{item.description}</p>}
              <p className="mt-2 text-xs text-primary">{item.url}</p>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
