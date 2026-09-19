// Recognises a skill mention while typing (the trigger is the same closing `)` the stock LINK
// transformer uses) and on paste, converting `[$name](path)` into a SkillMentionNode.
import type { TextMatchTransformer } from '@lexical/markdown'
import {
  $createSkillMentionNode,
  $isSkillMentionNode,
  SkillMentionNode,
} from '@/domains/sessions/renderer/components/composer/references/skill-mention-node'
import { SKILL_MENTION_SOURCE } from '@/domains/sessions/renderer/prompt/prompt-segments'

export const SKILL_MENTION_TRANSFORMER: TextMatchTransformer = {
  dependencies: [SkillMentionNode],
  export: (node) => ($isSkillMentionNode(node) ? node.getTextContent() : null),
  importRegExp: new RegExp(SKILL_MENTION_SOURCE),
  regExp: new RegExp(`${SKILL_MENTION_SOURCE}$`),
  replace: (textNode, match) => {
    const [, name, path] = match
    if (!name || !path) return
    const mentionNode = $createSkillMentionNode(name, path)
    textNode.replace(mentionNode)
    mentionNode.selectNext(0, 0)
  },
  trigger: ')',
  type: 'text-match',
}
