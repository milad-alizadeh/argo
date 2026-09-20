import type { OnboardingRecommendation } from './onboarding-model'

export const AGENT_RECOMMENDATIONS: OnboardingRecommendation[] = [
  {
    accepted: true,
    copyKey: 'argo-skill-bundle',
    group: 'agent-skills',
    href: 'https://github.com/milad-alizadeh/argo/tree/main/packages/argo-skills',
    id: 'argo-skill-bundle',
    icon: 'argo-skills',
    kind: 'action',
  },
  {
    accepted: true,
    copyKey: 'matt-pocock',
    group: 'agent-skills',
    href: 'https://github.com/mattpocock/skills',
    id: 'matt-pocock',
    icon: 'workflow',
    kind: 'action',
    waitsForUser: true,
  },
  {
    accepted: true,
    copyKey: 'writing-skills',
    group: 'agent-skills',
    href: 'https://github.com/milad-alizadeh/argo/tree/main/packages/argo-skills',
    id: 'writing-skills',
    icon: 'writing',
    kind: 'dependency',
  },
]
