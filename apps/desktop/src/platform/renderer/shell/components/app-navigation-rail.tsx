import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { DESTINATION_PATHS, DESTINATIONS, type Destination } from '@/platform/contract/commands'
import { Icon, type IconName } from '../../components/icon/icon'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip'
import { applyAppearance, useTheme } from '../../use-appearance'
import { AppearanceDialog } from './appearance-dialog'

const navigationControl =
  'no-drag-region grid size-(--size-navigation-control) place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-selected hover:text-foreground aria-[current=page]:bg-selected aria-[current=page]:text-foreground'

const navigationIcons: Record<Destination, IconName> = {
  Sessions: 'messages-square',
  Tickets: 'ticket',
  Atlas: 'atlas',
}

const navigationLabelKeys = {
  Sessions: 'rail.destinations.sessions',
  Tickets: 'rail.destinations.tickets',
  Atlas: 'rail.destinations.atlas',
} as const satisfies Record<Destination, string>

function destinationFromPathname(pathname: string, projectPath: string): Destination {
  return (
    DESTINATIONS.find((destination) => {
      const destinationPath = `${projectPath}${DESTINATION_PATHS[destination]}`
      return pathname === destinationPath || pathname.startsWith(`${destinationPath}/`)
    }) ?? 'Sessions'
  )
}

export const AppNavigationRail = memo(function AppNavigationRail() {
  const { t } = useTranslation('app')
  const location = useLocation()
  const navigate = useNavigate()
  const projectPath = location.pathname.match(/^\/projects\/[^/]+(?=\/|$)/)?.[0] ?? ''
  const destination = destinationFromPathname(location.pathname, projectPath)
  const settingsLabel = t('rail.settings')
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const appearanceState = useTheme()

  return (
    <TooltipProvider>
      <nav
        aria-label={t('rail.label')}
        className="no-drag-region flex h-full min-h-0 w-(--size-navigation-rail) shrink-0 flex-col items-center [&_*]:no-drag-region"
      >
        <div className="flex flex-col items-center gap-2 pt-(--inset-navigation-rail-item-top)">
          {DESTINATIONS.map((itemDestination) => {
            const iconName = navigationIcons[itemDestination]
            const active = destination === itemDestination
            const label = t(navigationLabelKeys[itemDestination])
            return (
              <Tooltip key={itemDestination}>
                <TooltipTrigger
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  aria-label={label}
                  className={navigationControl}
                  onClick={() => {
                    navigate(`${projectPath}${DESTINATION_PATHS[itemDestination]}`)
                  }}
                >
                  <Icon
                    className="size-(--size-navigation-icon)"
                    name={iconName}
                    weight={active ? 'fill' : 'regular'}
                  />
                </TooltipTrigger>
                <TooltipContent side="right" className="type-meta">
                  {label}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
        <div className="mt-auto flex h-(--size-bottom-status) shrink-0 items-center justify-center pb-1">
          <Tooltip>
            <TooltipTrigger
              type="button"
              aria-label={settingsLabel}
              onClick={() => setAppearanceOpen(true)}
              className={navigationControl}
            >
              <Icon className="size-(--size-navigation-icon)" name="settings" />
            </TooltipTrigger>
            <TooltipContent side="right" className="type-meta">
              {settingsLabel}
            </TooltipContent>
          </Tooltip>
        </div>
      </nav>
      <AppearanceDialog
        state={appearanceState}
        open={appearanceOpen}
        onOpenChange={setAppearanceOpen}
        onChoose={async (preference) => {
          const result = await window.argo.setAppearance(preference)
          applyAppearance(result.state)
          return result.ok
        }}
      />
    </TooltipProvider>
  )
})
