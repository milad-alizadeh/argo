import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { HarnessLogo } from '@/domains/sessions/renderer/harness/harness-logo'
import {
  HARNESSES,
  SESSION_CLIS,
  type SessionCli,
} from '@/domains/sessions/renderer/harness/harnesses'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/platform/renderer/components/ui/tabs'

export function HarnessTabs({
  cli,
  onChange,
  children,
}: {
  cli: SessionCli
  onChange?: (cli: SessionCli) => void
  children: ReactNode
}) {
  const { t } = useTranslation('sessions')
  return (
    <Tabs
      value={cli}
      onValueChange={(value) => {
        const chosen = SESSION_CLIS.find((option) => option === value)
        if (chosen) onChange?.(chosen)
      }}
      className="gap-0"
    >
      <div className="border-b p-2">
        <TabsList
          aria-label={t('harness.label')}
          className="grid w-full grid-cols-2 gap-1 p-1 group-data-horizontal/tabs:h-auto"
        >
          {SESSION_CLIS.map((option) => (
            <TabsTrigger
              key={option}
              disabled={onChange === undefined}
              tabIndex={onChange === undefined || option !== cli ? -1 : 0}
              value={option}
              className="h-8 gap-2 px-3 type-control text-muted-foreground data-active:bg-card"
            >
              <HarnessLogo cli={option} />
              {HARNESSES[option].label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {/* Base UI makes a panel a Tab stop; this one's first control is the stop instead. */}
      <TabsContent value={cli} tabIndex={-1}>
        {children}
      </TabsContent>
    </Tabs>
  )
}
