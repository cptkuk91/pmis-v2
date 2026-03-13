type QcSortOption = {
  value: string;
  label: string;
};

type QcSortSelectProps = {
  value: string;
  options: QcSortOption[];
  onChange: (value: string) => void;
  label?: string;
  compact?: boolean;
  className?: string;
};

export function QcSortSelect({
  value,
  options,
  onChange,
  label = "정렬",
  compact = false,
  className = "",
}: QcSortSelectProps) {
  if (compact) {
    return (
      <label className={`flex items-center gap-2 text-sm text-foreground ${className}`.trim()}>
        <span className="shrink-0 font-medium">{label}</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 min-w-[180px] rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className={`space-y-1 ${className}`.trim()}>
      <span className="block text-sm font-medium text-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
