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
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  emptyMessage = "데이터가 없습니다.",
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
                className="border-b border-border transition-colors hover:bg-background-soft last:border-b-0"
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
