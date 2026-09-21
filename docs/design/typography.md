# Desktop typography

The desktop app uses one type system across all product surfaces. The system uses Geist Sans for
interface text and Geist Mono for code, paths, keys, commands, and identifiers. The app bundles
both variable families through Fontsource. System fonts remain as fallbacks.

## Research decision

Argo uses a productive scale for a dense macOS app:

- [Geist](https://github.com/vercel/geist-font) provides a restrained sans family and a matched
  mono family designed for code and other technical interfaces.
- [Apple's macOS scale](https://developer.apple.com/design/human-interface-guidelines/typography)
  uses 13pt body text, 11pt subheadings, and 15pt third-level titles. Apple recommends 10pt as
  the macOS minimum.
- [Fluent 2 for macOS](https://fluent2.microsoft.design/typography) uses the same 13pt body,
  11pt subtitle, and 15pt title region. Its web scale uses 12px captions, 14px body text, and
  16px subtitles.
- [Carbon's productive set](https://carbondesignsystem.com/elements/typography/type-sets/) uses
  IBM Plex Sans at 14px for body and headings. Weight creates the heading distinction. It uses
  12px for labels and IBM Plex Mono code.
- [Primer's product scale](https://next.primer.style/product/primitives/typography/) uses 12px,
  14px, and 16px body steps. Its code block size is 13px.
- [OpenAI's public guidance](https://openai.com/brand/) describes a sans that combines geometric
  precision with human warmth. It also calls out tabular figures. It does not publish a product
  UI size scale.

These systems use a small number of neighboring sizes. Argo uses 14px for interface and reading
text, including controls. It uses 12px for dense metadata. Technical text uses Geist Mono at
13px. Headings change weight instead of size. The 18px title applies only to detail pages.

## Text surface map

| Surface | Text that appears | Roles |
| --- | --- | --- |
| Cockpit chrome and navigation | Project name, route labels, and account control | `body` and `control` |
| Sessions roster | Session name, current activity, timing, plan progress, agent count, pull request, and ticket | `body` with medium emphasis for the name, then `meta` for all supporting facts |
| Sessions feed | User and agent messages, Markdown, events, tool-call summaries, markers, questions, code, and diagrams | `body` for events and tool-call summaries, `prose` for messages, `heading` for document structure, `meta` for supporting facts, and `code` for source or output |
| Session composer and context | Draft Markdown, placeholders, toolbar controls, menus, plan steps, usage, permissions, attachments, and references | `prose` for the draft, `control` for actions and menu labels, `heading` for sections, `body` for queued text, `meta` for supporting facts, and `code` for commands |
| Session inspector and work | File names, evidence titles, delegation details, diffs, terminal output, and unavailable states | `body` for primary labels, `meta` for supporting facts, and `code` for source, diffs, and output |
| Tickets sidebar and detail | Backlog headings, ticket key and title, status, priority, labels, age, properties, links, and descriptions | `title` for the selected ticket, `heading` for groups, `body` for ticket titles and descriptions, `control` for section labels, `meta` for properties, and `code` for keys |
| Account and project dialogs | Account name, provider, project, path, sign-in code, status, and errors | `title` for the sign-in code, `body` for primary text, `meta` for supporting facts, and `code` for paths and provider labels |
| Shared UI primitives | Dialog, menu, input, tooltip, badge, table, and other shadcn defaults | The primitive owns its default. An app surface supplies a semantic role when it needs the product scale. |

The Atlas page has no reader text yet. Story fixtures do not set the production contract.

## Role contract

| Role | Size and line height | Weight | Use |
| --- | --- | --- | --- |
| `title` | 18/24px | 500 | The main title in a detail surface or a large value |
| `heading` | 14/20px | 500 | A pane, group, or document heading |
| `body` | 14/20px | 400 | Dense interface text and list titles |
| `prose` | 14/20px | 400 | Messages, Markdown, and longer reading |
| `control` | 14/20px | 500 | Buttons, tabs, menu labels, and compact section labels |
| `meta` | 12/16px | 400 | Timing, state, counts, paths, and supporting facts |
| `code` | 13/19px | 400 | Code, terminal output, and machine identifiers |

Use medium or semibold emphasis only when text must differ from adjacent text in the same role.
Use tabular numerals for timing, percentages, progress, and counts.

## Composition boundary

App-owned components use `type-title`, `type-heading`, `type-body`, `type-prose`, `type-control`,
`type-meta`, and `type-code`. They do not use Tailwind size rungs such as `text-sm` or `text-base`.
Nested Markdown nodes can use token-backed `text-title` and `text-heading` utilities because the
editor cannot attach a role class to those generated nodes.

Shared UI primitives keep their generated shadcn rung names. `components.json` keeps
`tailwind.cssVariables` enabled, and the Tailwind v4 `@theme inline` contract maps `text-xs`,
`text-sm`, and `text-base` to the dominant 14px rung. A shadcn update therefore inherits Argo's
scale without per-component patches. Product components use a semantic role when their meaning is
more specific than the primitive default; the role adds intent rather than correcting the
primitive. `type-label` remains a compatibility alias for existing labels. New app-owned code
uses `type-control`.
