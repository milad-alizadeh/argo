import { SearchField } from './design-system/search-field'

export function SidebarSearch({
  label,
  maxLength,
  onChange,
  placeholder,
  value,
}: {
  label: string
  maxLength?: number
  onChange: (value: string) => void
  placeholder: string
  value: string
}) {
  return (
    <SearchField
      aria-label={label}
      maxLength={maxLength}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      value={value}
    />
  )
}
