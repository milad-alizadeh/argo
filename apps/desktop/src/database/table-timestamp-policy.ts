export const tableTimestampPolicy = {
  managed_workspace_recovery: 'timestamps',
  project: 'timestamps',
  project_selection: 'timestamps',
  project_setup_actor: 'timestamps',
  project_setup_checkpoint: 'timestamps',
  project_setup_effect: 'timestamps',
  project_setup_recovery: 'timestamps',
  project_workspace_selection: 'timestamps',
  session: 'timestamps',
  session_search: 'virtual-index',
  session_ticket_link: 'timestamps',
  workspace: 'timestamps',
} as const
