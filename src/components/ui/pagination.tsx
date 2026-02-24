"use client";

type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={!canPrev}
        onClick={() => onPageChange(page - 1)}
        className="rounded-md border border-border bg-background-card px-3 py-1 text-sm hover:bg-background-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        이전
      </button>
      <span className="text-sm text-foreground-muted">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={!canNext}
        onClick={() => onPageChange(page + 1)}
        className="rounded-md border border-border bg-background-card px-3 py-1 text-sm hover:bg-background-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        다음
      </button>
    </div>
  );
}
