import type { ReactNode } from "react";

export type DataTableColumn<T> = {
  key: keyof T;
  header: string;
  className?: string;
  render?: (value: T[keyof T], row: T) => ReactNode;
};

type DataTableProps<T> = {
  columns: Array<DataTableColumn<T>>;
  data: T[];
  rowKey: (row: T, index: number) => string;
  emptyMessage?: string;
  onRowClick?: (row: T, index: number) => void;
  getRowAriaLabel?: (row: T, index: number) => string;
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  emptyMessage = "데이터가 없습니다.",
  onRowClick,
  getRowAriaLabel,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-background-card shadow-[var(--shadow-soft)]">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-background-soft">
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={`border-b border-border px-3 py-2 text-left font-semibold text-foreground ${column.className ?? ""}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-8 text-center text-foreground-muted"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={rowKey(row, index)}
                className={`border-b border-border transition-colors last:border-b-0 ${
                  onRowClick
                    ? "cursor-pointer hover:bg-background-soft focus-within:bg-background-soft focus-visible:bg-background-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-border"
                    : "hover:bg-background-soft"
                }`}
                onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick(row, index);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick ? getRowAriaLabel?.(row, index) : undefined}
              >
                {columns.map((column) => {
                  const value = row[column.key];
                  return (
                    <td
                      key={`${rowKey(row, index)}-${String(column.key)}`}
                      className={`px-3 py-2 text-foreground ${column.className ?? ""}`}
                    >
                      {column.render ? column.render(value, row) : String(value ?? "")}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
