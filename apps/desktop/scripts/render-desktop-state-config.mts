const ONBOARDING_STORY = 'projects-project-onboarding--'

export function renderStateConfig(story: string): { outputName: string; selector: string } {
  if (story.startsWith(ONBOARDING_STORY))
    return {
      outputName: 'project-onboarding.png',
      selector: '[data-component="ProjectOnboarding"]',
    }
  return { outputName: 'app-surface.png', selector: '[data-component="AppSurface"]' }
}
