import type { ReactNode } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs'
import { HarnessLogo } from './HarnessLogo'
import { HARNESSES, SESSION_CLIS, type SessionCli } from './harnesses'

// Extracted from the composer prototype (602bcce2): the run setup's harness tabs, whose panel is
// the chosen harness's own Model and Effort.
export function HarnessTabs({
  cli,
  onChange,
  children,
}: {
  cli: SessionCli
  onChange?: (cli: SessionCli) => void
  children: ReactNode
}) {
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
          aria-label="Harness"
          className="grid w-full grid-cols-2 gap-1 p-1 group-data-horizontal/tabs:h-auto"
        >
          {SESSION_CLIS.map((option) => (
            <TabsTrigger
              key={option}
              disabled={onChange === undefined}
              tabIndex={onChange === undefined ? -1 : undefined}
              value={option}
              className="h-8 gap-2 px-3 type-label font-medium text-muted-foreground data-active:bg-card"
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
