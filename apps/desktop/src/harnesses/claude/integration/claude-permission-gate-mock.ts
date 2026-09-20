import type { ClaudePermissionGate } from '@/harnesses/claude/drive/permission-gate.ts'

// A gate that never raises a Permission, for a test with nothing to say about Permission behavior.
// It still writes a real (inert) hook into the plugin, the way the real gate's `open` would.
export function mockPermissionGate(): ClaudePermissionGate {
  return {
    open: () => ({
      hook: { event: 'PreToolUse', file: 'permission-hook.sh', script: '' },
      close: () => {},
    }),
    pending: () => null,
    decide: () => false,
    onChanged: () => () => {},
    close: () => {},
  }
}
