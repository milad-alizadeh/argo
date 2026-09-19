export function CatalogText({ label }: { label: string }) {
  return (
    <button aria-label={label} type="button">
      {label}
    </button>
  )
}
