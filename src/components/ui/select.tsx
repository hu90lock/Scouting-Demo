import { Select as SelectPrimitive } from "@base-ui/react/select"
import { Check, ChevronsUpDown } from "lucide-react"

export type SelectOption = { value: string; label: string }

export function Select({ value, options, onValueChange, placeholder, disabled, "aria-label": ariaLabel }: {
  value: string
  options: SelectOption[]
  onValueChange: (value: string) => void
  placeholder: string
  disabled?: boolean
  "aria-label": string
}) {
  return <SelectPrimitive.Root value={value || null} onValueChange={next => onValueChange(next === "__unassigned__" || next === null ? "" : String(next))} disabled={disabled}>
    <SelectPrimitive.Trigger className="input scout-select-trigger" aria-label={ariaLabel}>
      <SelectPrimitive.Value placeholder={placeholder}>{selected => options.find(option => option.value === selected)?.label ?? (selected ? "Scout nickname unavailable" : placeholder)}</SelectPrimitive.Value>
      <SelectPrimitive.Icon><ChevronsUpDown className="size-4" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner className="scout-select-positioner" sideOffset={6}>
        <SelectPrimitive.Popup className="scout-select-popup">
          <SelectPrimitive.List>
            <SelectPrimitive.Item className="scout-select-item" value="__unassigned__">
              <SelectPrimitive.ItemText>Unassigned</SelectPrimitive.ItemText>
              <SelectPrimitive.ItemIndicator><Check className="size-4" /></SelectPrimitive.ItemIndicator>
            </SelectPrimitive.Item>
            {options.map(option => <SelectPrimitive.Item className="scout-select-item" value={option.value} key={option.value}>
              <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              <SelectPrimitive.ItemIndicator><Check className="size-4" /></SelectPrimitive.ItemIndicator>
            </SelectPrimitive.Item>)}
          </SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>
}
