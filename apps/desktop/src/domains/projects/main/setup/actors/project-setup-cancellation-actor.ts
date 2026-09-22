import { projectSetupCancellationLogic } from '../project-setup-cancellation-logic'
import type { ProjectSetupServices } from './project-setup-actors'

export {
  type ProjectSetupCancellationInput,
  projectSetupCancellationInput,
} from '../project-setup-cancellation-logic'

export function projectSetupCancellationActor(services: ProjectSetupServices) {
  return projectSetupCancellationLogic(services)
}
