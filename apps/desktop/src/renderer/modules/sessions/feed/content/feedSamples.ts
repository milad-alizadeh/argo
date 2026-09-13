// Story content for the formatted Feed. The picture is inline, so no story reaches the network.
const PICTURE = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="213" viewBox="0 0 320 213"><rect width="320" height="213" fill="#0ea5e9"/><circle cx="96" cy="106" r="48" fill="#f8fafc"/><rect x="168" y="70" width="112" height="72" rx="8" fill="#0f172a"/></svg>`

export const SAMPLE_PICTURE = `data:image/svg+xml,${encodeURIComponent(PICTURE)}`

// Decodes as no image at all, which is the failure a broken file draws.
export const BROKEN_PICTURE = 'data:image/png;base64,AAAA'

export const SAMPLE_TYPESCRIPT = `type Session = { id: string; title: string }

export function sessionTitle(session: Session): string {
  return session.title || session.id
}`

export const RICH_MARKDOWN = `The composer stays **one surface**, and the tray keeps its width. I checked it against [#1824](https://github.com/milad-alizadeh/argo/issues/1824).

\`\`\`ts
${SAMPLE_TYPESCRIPT}
\`\`\`

\`\`\`argo-plan
step one: attach an image
step two: send the Turn
\`\`\`

| Case | Behavior | Result |
| --- | --- | --- |
| One attachment | Fits beside the draft | Passed |
| Narrow window | Controls stay visible | Passed |

![The attached reference](${SAMPLE_PICTURE}) ![A file the Session moved](shots/missing.png)

> Keep the active Session and its work visible while composing.

## What changed

- Attachments stay in a single row.
- The draft stays \`editable\` throughout.

* [x] Draft restored
* [ ] Narrow layout review

---

Raw HTML stays text: <script>window.feedHacked = true</script>`
