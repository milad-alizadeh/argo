import { projectSetupPlanningLogic } from '../project-setup-planning-logic'
import type { ProjectSetupServices } from './project-setup-actors'

export {
  type ProjectSetupPlanningInput,
  projectSetupPlanningInput,
} from '../project-setup-planning-logic'

export function projectSetupPlanningActor(services: ProjectSetupServices, projectId: string) {
  return projectSetupPlanningLogic(services, projectId)
}
