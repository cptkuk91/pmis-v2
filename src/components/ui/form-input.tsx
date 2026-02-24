import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type FormInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  wrapperClassName?: string;
};

export function FormInput({
  label,
  id,
  error,
  className,
  wrapperClassName,
  ...props
}: FormInputProps) {
  const inputId = id ?? props.name ?? `field-${label}`;

  return (
    <div className={cn("space-y-1", wrapperClassName)}>
      <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={inputId}
        className={cn(
          "h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15",
          error && "border-danger focus:ring-danger/30",
          className,
        )}
        {...props}
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
