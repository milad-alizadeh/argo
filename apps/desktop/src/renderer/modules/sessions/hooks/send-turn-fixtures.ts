import type { ProjectSummary } from '@/core/projects/messages'

export const PROJECT: ProjectSummary = { id: 'project-1', name: 'argo', path: '/argo' }
export const SETUP = { model: 'sonnet', effort: 'high', mode: 'default' }
export const COCKPIT = {
  status: 'selected' as const,
  project: PROJECT,
  projects: [PROJECT],
  message: null,
  code: null,
  busy: false,
}

// A mutation that records each call and answers with `reply`, standing in for the IPC round trip.
export function fakeMutation<Args, Reply>(reply: (args: Args) => Promise<Reply>) {
  const calls: Args[] = []
  return {
    calls,
    mutateAsync: async (args: Args) => {
      calls.push(args)
      return reply(args)
    },
  }
}
