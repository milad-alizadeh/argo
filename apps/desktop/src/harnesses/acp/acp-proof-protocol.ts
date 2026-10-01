// The executable a Session proof starts in place of an ACP agent's; empty reads as not installed.
export function acpExecutableOverride(harness: string): string {
  return `ARGO_${harness.toUpperCase().replaceAll('-', '_')}_EXECUTABLE`
}
