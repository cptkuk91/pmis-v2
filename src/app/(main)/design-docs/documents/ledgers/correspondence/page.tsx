"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DocumentLedgerView } from "@/components/features/design-docs/document-ledger-view";

type DirectionTab = "outbound" | "inbound";

function parseDirection(value: string | null): DirectionTab {
  return value === "inbound" ? "inbound" : "outbound";
}

export default function CorrespondenceLedgerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryDirection = parseDirection(searchParams.get("direction"));
  const [direction, setDirection] = useState<DirectionTab>(queryDirection);

  useEffect(() => {
    setDirection(queryDirection);
  }, [queryDirection]);

  function handleChangeDirection(nextDirection: DirectionTab) {
    setDirection(nextDirection);
    const params = new URLSearchParams(searchParams.toString());
    params.set("direction", nextDirection);
    router.replace(`/design-docs/documents/ledgers/correspondence?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)] sm:p-6">
        <header>
          <h1 className="text-xl font-semibold text-foreground">문서 수신/발신</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            외부 수신/발신 문서를 한 화면에서 조회합니다.
          </p>
        </header>

        <nav className="mt-4 flex flex-wrap gap-1 rounded-lg border border-border bg-background p-1">
          <button
            type="button"
            onClick={() => handleChangeDirection("outbound")}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              direction === "outbound"
                ? "bg-[#ecebe8] font-medium text-foreground"
                : "text-foreground-muted hover:bg-background-soft hover:text-foreground"
            }`}
          >
            발신
          </button>
          <button
            type="button"
            onClick={() => handleChangeDirection("inbound")}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              direction === "inbound"
                ? "bg-[#ecebe8] font-medium text-foreground"
                : "text-foreground-muted hover:bg-background-soft hover:text-foreground"
            }`}
          >
            수신
          </button>
        </nav>
      </section>

      <DocumentLedgerView
        key={direction}
        title={direction === "outbound" ? "발신문서" : "수신문서"}
        description={
          direction === "outbound"
            ? "외부로 발신한 문서를 조회합니다."
            : "외부에서 수신한 문서를 조회합니다."
        }
        fixedDirection={direction}
      />
    </div>
  );
}
