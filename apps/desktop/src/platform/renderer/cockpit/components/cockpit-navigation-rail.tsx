import { memo } from 'react'
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

function destinationFromPathname(pathname: string): Destination {
  return (
    DESTINATIONS.find((destination) => pathname === DESTINATION_PATHS[destination]) ?? 'Sessions'
  )
}

export const CockpitNavigationRail = memo(function CockpitNavigationRail() {
  const { t } = useTranslation('cockpit')
  const location = useLocation()
  const navigate = useNavigate()
  const destination = destinationFromPathname(location.pathname)
  const settingsLabel = t('rail.settings')

  return (
    <TooltipProvider>
      <nav
        aria-label={t('rail.label')}
        className="no-drag-region flex h-full min-h-0 w-(--size-navigation-rail) shrink-0 flex-col items-center [&_*]:no-drag-region [&_svg]:size-(--size-navigation-icon)"
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
                  className={`no-drag-region grid size-(--size-navigation-control) place-items-center rounded-lg transition-colors ${active ? 'bg-selected text-foreground' : 'text-muted-foreground hover:bg-selected hover:text-foreground'}`}
                  onClick={() => {
                    navigate(DESTINATION_PATHS[itemDestination])
                  }}
                >
                  <Icon name={iconName} />
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
              className="no-drag-region grid size-(--size-navigation-control) place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-selected hover:text-foreground"
            >
              <Icon name="settings" />
            </TooltipTrigger>
            <TooltipContent side="right" className="type-meta">
              {settingsLabel}
            </TooltipContent>
          </Tooltip>
        </div>
      </nav>
    </TooltipProvider>
  )
})
