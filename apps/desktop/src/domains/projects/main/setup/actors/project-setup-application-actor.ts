import { projectSetupApplicationLogic } from '../project-setup-application-logic'
import type { ProjectSetupServices } from './project-setup-actors'

export {
  type ProjectSetupApplicationInput,
  projectSetupApplicationInput,
} from '../project-setup-application-logic'

export function projectSetupApplicationActor(services: ProjectSetupServices, projectId: string) {
  return projectSetupApplicationLogic(services, projectId)
}
