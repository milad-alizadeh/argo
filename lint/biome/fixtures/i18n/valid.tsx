export function ValidReaderText({ label }: { label: string }) {
  return (
    <button aria-label={label} title={label} type="button">
      {label}
    </button>
  )
}
