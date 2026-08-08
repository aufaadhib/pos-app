"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";

type CurrencyInputProps = Omit<React.ComponentProps<typeof Input>, "defaultValue" | "inputMode" | "name" | "onChange" | "type" | "value"> & {
  allowNegative?: boolean;
  defaultValue?: string;
  maxDigits?: number;
  name?: string;
  onValueChange?: (value: string) => void;
  value?: string;
};

/** Displays Indonesian thousands separators while preserving raw integer form values. */
export function CurrencyInput({ allowNegative = false, defaultValue = "", maxDigits = 12, name, onValueChange, value, ...props }: CurrencyInputProps) {
  const [localValue, setLocalValue] = React.useState(() => normalizeMoneyInput(defaultValue, allowNegative, maxDigits));
  const rawValue = value === undefined ? localValue : normalizeMoneyInput(value, allowNegative, maxDigits);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextValue = normalizeMoneyInput(event.target.value, allowNegative, maxDigits);
    if (value === undefined) setLocalValue(nextValue);
    onValueChange?.(nextValue);
  }

  return <>
    <Input {...props} autoComplete="off" inputMode="numeric" onChange={handleChange} type="text" value={formatMoneyInput(rawValue)} />
    {name && <input name={name} type="hidden" value={rawValue} />}
  </>;
}

/** Keeps only an optional leading minus and a bounded count of integer digits. */
export function normalizeMoneyInput(value: string, allowNegative = false, maxDigits = 12) {
  const negative = allowNegative && value.trim().startsWith("-");
  const digits = value.replace(/\D/g, "").slice(0, maxDigits).replace(/^0+(?=\d)/, "");
  return `${negative && digits ? "-" : ""}${digits}`;
}

/** Adds dot separators without converting the value through floating point. */
export function formatMoneyInput(value: string) {
  const negative = value.startsWith("-");
  const digits = value.replace(/\D/g, "");
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative && digits ? "-" : ""}${formatted}`;
}
