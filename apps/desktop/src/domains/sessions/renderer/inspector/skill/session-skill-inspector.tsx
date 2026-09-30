import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { trpcClient } from '@/platform/renderer/trpc-client'
import { FeedMarkdown } from '../../feed/content'
import type { SessionSkillEvidence } from '../../types'

// A skill file opens with YAML frontmatter for the Harness; the reader wants the instructions below.
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/

function useSkillContent(path: string) {
  const [content, setContent] = useState<{ path: string; text: string | null } | null>(null)
  useEffect(() => {
    let current = true
    void trpcClient.sessionSkillRead.query({ path }).then((reply) => {
      if (!current) return
      setContent({ path, text: reply.content?.replace(FRONTMATTER, '') ?? null })
    })
    return () => {
      current = false
    }
  }, [path])
  return content?.path === path ? content : null
}

export function SessionSkillBody({ path }: { path: string }) {
  const { t } = useTranslation('sessions')
  const content = useSkillContent(path)
  if (content === null)
    return <p className="type-meta text-muted-foreground">{t('skill.reading')}</p>
  if (content.text === null)
    return <p className="type-meta text-muted-foreground">{t('skill.unavailable')}</p>
  return <FeedMarkdown text={content.text} />
}

export function SessionSkillInspector({ evidence }: { evidence: SessionSkillEvidence }) {
  const { t } = useTranslation('sessions')
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={t('skill.inspector')}>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <SessionSkillBody path={evidence.path} />
      </div>
    </section>
  )
}
