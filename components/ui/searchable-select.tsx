"use client"

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type SearchableSelectOption = {
  value: string
  label: string
}

type SearchableSelectProps = {
  "aria-invalid"?: boolean
  "aria-label"?: string
  className?: string
  defaultValue?: string
  disabled?: boolean
  emptyMessage?: string
  id?: string
  name?: string
  onValueChange?: (value: string) => void
  options: readonly SearchableSelectOption[]
  placeholder?: string
  required?: boolean
  value?: string
}

/**
 * Renders a form-compatible single-value combobox with built-in text filtering.
 * It submits the selected option value, displays its label, and does not mutate external state
 * unless `onValueChange` is provided.
 */
export function SearchableSelect({
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
  className,
  defaultValue,
  disabled,
  emptyMessage = "Pilihan tidak ditemukan.",
  id,
  name,
  onValueChange,
  options,
  placeholder = "Cari dan pilih",
  required,
  value,
}: SearchableSelectProps) {
  const selectedOption = value === undefined
    ? undefined
    : options.find((option) => option.value === value) ?? null
  const defaultOption = options.find((option) => option.value === defaultValue) ?? null

  return (
    <ComboboxPrimitive.Root
      autoHighlight
      defaultValue={defaultOption}
      disabled={disabled}
      items={options}
      name={name}
      onValueChange={(option, eventDetails) => {
        if (eventDetails.reason === "item-press" || eventDetails.reason === "clear-press") {
          onValueChange?.(option?.value ?? "")
        }
      }}
      required={required}
      value={selectedOption}
    >
      <ComboboxPrimitive.InputGroup
        className={cn(
          "relative flex h-12 w-full min-w-0 items-center rounded-lg border border-input bg-card transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40 has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 has-disabled:cursor-not-allowed has-disabled:opacity-50 dark:bg-input/20",
          className
        )}
      >
        <SearchIcon aria-hidden="true" className="pointer-events-none ml-3 size-4 shrink-0 text-muted-foreground" />
        <ComboboxPrimitive.Input
          aria-invalid={ariaInvalid}
          aria-label={ariaLabel}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed sm:text-sm"
          disabled={disabled}
          id={id}
          placeholder={placeholder}
        />
        <ComboboxPrimitive.Trigger
          aria-label="Buka pilihan"
          className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none"
          disabled={disabled}
        >
          <ChevronDownIcon aria-hidden="true" className="size-4" />
        </ComboboxPrimitive.Trigger>
      </ComboboxPrimitive.InputGroup>
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner
          align="start"
          className="isolate z-50 outline-none"
          collisionAvoidance={{ side: "none", align: "shift" }}
          side="bottom"
          sideOffset={6}
        >
          <ComboboxPrimitive.Popup className="group/combobox-content w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-2">
            <ComboboxPrimitive.Empty className="hidden px-3 py-5 text-center text-sm text-muted-foreground group-data-empty/combobox-content:block">
              {emptyMessage}
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List className="max-h-[min(15rem,var(--available-height))] scroll-py-1 overflow-y-auto overscroll-contain p-1 outline-none data-empty:p-0">
              {(option: SearchableSelectOption) => (
                <ComboboxPrimitive.Item
                  className="relative flex min-h-11 cursor-default items-center rounded-lg py-2 pr-9 pl-3 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
                  key={option.value}
                  value={option}
                >
                  <span className="truncate">{option.label}</span>
                  <ComboboxPrimitive.ItemIndicator className="absolute right-3 grid size-4 place-items-center">
                    <CheckIcon aria-hidden="true" className="size-4" />
                  </ComboboxPrimitive.ItemIndicator>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  )
}
