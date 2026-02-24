import type { InputHTMLAttributes } from "react";
import { FormInput } from "@/components/ui/form-input";

type DatePickerProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  error?: string;
};

export function DatePicker({ label, error, ...props }: DatePickerProps) {
  return <FormInput type="date" label={label} error={error} {...props} />;
}
