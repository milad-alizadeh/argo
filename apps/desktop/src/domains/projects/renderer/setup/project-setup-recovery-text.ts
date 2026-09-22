import type { TFunction } from 'i18next'
import type { ProjectSetupRecoveryCode } from '@/domains/projects/contract/setup/project-setup-recovery'

export const PROJECT_SETUP_RECOVERY_KEYS = {
  interrupted: 'setup.actor.recovery.interrupted',
  'application-drift': 'setup.actor.recovery.application-drift',
  cancelled: 'setup.actor.recovery.cancelled',
  'cancel-failed': null,
  'finalization-failed': 'setup.actor.recovery.finalization-failed',
  'restart-interrupted': null,
  'restart-finalization-unconfirmed': 'setup.actor.recovery.restart-finalization-unconfirmed',
} as const satisfies Record<ProjectSetupRecoveryCode, string | null>

export function projectSetupRecoveryText(
  t: TFunction<'projects'>,
  code: ProjectSetupRecoveryCode | null,
): string | null {
  if (!code) return null
  const key = PROJECT_SETUP_RECOVERY_KEYS[code]
  return key ? t(key) : null
}
