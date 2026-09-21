import { memo, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, type IconName } from '@/platform/renderer/components/icon'
import {
  DESTINATION_PATHS,
  DESTINATIONS,
  type Destination,
  navigateCommand,
  shortcut,
} from '@/platform/shared/commands'

const navigationIcons: Record<Destination, IconName> = {
  Sessions: 'messages-square',
  Tickets: 'ticket',
  Atlas: 'atlas',
}

function destinationFromHash(): Destination {
  return (
    DESTINATIONS.find(
      (destination) => window.location.hash === `#${DESTINATION_PATHS[destination]}`,
    ) ?? 'Sessions'
  )
}

export const CockpitNavigationRail = memo(function CockpitNavigationRail() {
  const { t } = useTranslation(['cockpit', 'platform'])
  const [destination, setDestination] = useState(destinationFromHash)
  const settingsLabel = t('cockpit:rail.settings')

  useEffect(() => {
    const updateDestination = () => setDestination(destinationFromHash())
    window.addEventListener('hashchange', updateDestination)
    return () => window.removeEventListener('hashchange', updateDestination)
  }, [])

  return (
    <nav
      aria-label={t('cockpit:rail.label')}
      className="flex h-full min-h-0 w-(--size-navigation-rail) shrink-0 flex-col items-center border-r border-border/60 bg-sidebar [&_svg]:size-(--size-icon-control)"
    >
      <div className="flex flex-col items-center gap-2 pt-(--inset-navigation-rail-item-top)">
        {DESTINATIONS.map((itemDestination) => {
          const iconName = navigationIcons[itemDestination]
          const active = destination === itemDestination
          const label = t(`platform:${shortcut(navigateCommand(itemDestination)).labelKey}`)
          return (
            <button
              key={itemDestination}
              type="button"
              aria-current={active ? 'page' : undefined}
              aria-label={label}
              className="group flex flex-col items-center gap-1 type-meta"
              onClick={() => {
                window.location.hash = DESTINATION_PATHS[itemDestination]
              }}
            >
              <span
                className={`grid size-9 place-items-center rounded-lg transition-colors ${
                  active
                    ? 'bg-selected text-foreground'
                    : 'text-muted-foreground group-hover:bg-muted group-hover:text-foreground'
                }`}
              >
                <Icon name={iconName} />
              </span>
              <span className={active ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-auto flex h-(--size-bottom-status) shrink-0 items-center justify-center pb-1">
        <button
          type="button"
          aria-label={settingsLabel}
          className="group flex flex-col items-center gap-1 type-meta"
        >
          <span className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors group-hover:bg-sidebar group-hover:text-foreground">
            <Icon name="settings" />
          </span>
          <span className="text-muted-foreground">{settingsLabel}</span>
        </button>
      </div>
    </nav>
  )
})
