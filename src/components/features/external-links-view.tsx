"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/ui";

type ExternalLinkItem = {
  _id: string;
  category: string;
  name: string;
  url: string;
  description: string;
};

type Props = {
  title: string;
  category: "laws" | "ks" | "pro-sites";
  description: string;
};

export function ExternalLinksView({ title, category, description }: Props) {
  const [items, setItems] = useState<ExternalLinkItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/system/external-links?category=${category}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as {
          ok: boolean;
          data: ExternalLinkItem[];
          error?: string;
        };
        if (!result.ok) {
          throw new Error(result.error ?? "외부 링크 조회 실패");
        }
        setItems(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "외부 링크 조회 실패");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [category]);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-foreground-muted">{description}</p>
      </header>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable<ExternalLinkItem>
        columns={[
          { key: "name", header: "사이트명" },
          { key: "description", header: "설명" },
          {
            key: "url",
            header: "URL",
            render: (value) => (
              <a
                href={String(value)}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2"
              >
                {String(value)}
              </a>
            ),
          },
        ]}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "등록된 외부 링크가 없습니다."}
      />
    </section>
  );
}
