import { Icon } from './icon/icon'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  inlineSearchGroupClassName,
} from './ui/input-group'

// The search field at the head of a sidebar: borderless until focused.
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
    <InputGroup className={inlineSearchGroupClassName}>
      <InputGroupAddon className="pl-(--spacing-shell-icon)">
        <Icon name="search" />
      </InputGroupAddon>
      <InputGroupInput
        aria-label={label}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </InputGroup>
  )
}
