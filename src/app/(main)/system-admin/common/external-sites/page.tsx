"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLinksView } from "@/components/features/external-links-view";

type ExternalCategory = "laws" | "ks" | "pro-sites";

const categoryMeta: Record<
  ExternalCategory,
  { label: string; title: string; description: string }
> = {
  laws: {
    label: "법률정보",
    title: "법률정보",
    description: "법률/규정 관련 외부 사이트 링크 목록",
  },
  ks: {
    label: "KS 규격검색",
    title: "KS 규격검색",
    description: "KS 규격 관련 외부 사이트 링크 목록",
  },
  "pro-sites": {
    label: "전문사이트",
    title: "전문사이트",
    description: "종합건설정보/전문사이트 링크 목록",
  },
};

function parseCategory(value: string | null): ExternalCategory {
  if (value === "laws" || value === "ks" || value === "pro-sites") {
    return value;
  }
  return "laws";
}

export default function ExternalSitesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryFromQuery = parseCategory(searchParams.get("category"));
  const [category, setCategory] = useState<ExternalCategory>(categoryFromQuery);

  useEffect(() => {
    setCategory(categoryFromQuery);
  }, [categoryFromQuery]);

  const selected = useMemo(() => categoryMeta[category], [category]);

  function handleChangeCategory(nextCategory: ExternalCategory) {
    setCategory(nextCategory);
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", nextCategory);
    router.replace(`/system-admin/common/external-sites?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)] sm:p-6">
        <header>
          <h1 className="text-xl font-semibold text-foreground">외부사이트</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            법률정보/KS 규격/전문사이트 링크를 한 화면에서 조회합니다.
          </p>
        </header>
        <nav className="mt-4 flex flex-wrap gap-1 rounded-lg border border-border bg-background p-1">
          {(
            Object.keys(categoryMeta) as ExternalCategory[]
          ).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleChangeCategory(item)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                category === item
                  ? "bg-[#ecebe8] font-medium text-foreground"
                  : "text-foreground-muted hover:bg-background-soft hover:text-foreground"
              }`}
            >
              {categoryMeta[item].label}
            </button>
          ))}
        </nav>
      </section>

      <ExternalLinksView
        key={category}
        title={selected.title}
        description={selected.description}
        category={category}
        showHeader={false}
      />
    </div>
  );
}
