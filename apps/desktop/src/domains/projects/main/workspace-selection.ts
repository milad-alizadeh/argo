export type WorkspaceSelection =
  | { kind: 'main' }
  | { kind: 'existing'; workspaceId: string }
  | { kind: 'new'; baseRef: string }
