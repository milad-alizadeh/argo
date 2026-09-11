import { COMPOSER_CODE, FEED_EVIDENCE, type FeedEvidenceAction } from './evidence'
import { FeedDiagram } from './FeedDiagram'
import { FeedEvidenceLink } from './FeedEvidenceLink'
import { FeedImages } from './FeedImages'
import { FeedCode, FeedTurn } from './FeedPrimitives'
import { FEED_CARD_RADIUS_CLASS } from './feedSurface'

export function FeedRichContent({ onOpen }: { onOpen: FeedEvidenceAction }) {
  return (
    <FeedTurn>
      <p className="text-body leading-relaxed">
        The composer stays one surface. The image tray scrolls horizontally, while the message field
        and run controls keep their width. I checked the layout against{' '}
        <FeedEvidenceLink evidence={FEED_EVIDENCE.fetched} onOpen={onOpen}>
          #1824
        </FeedEvidenceLink>
        .
      </p>
      <FeedCode source={COMPOSER_CODE} />
      <p className="text-body leading-relaxed">
        The two Session drivers share the same composer. Their transport remains separate:
      </p>
      <FeedDiagram onOpen={onOpen} />
      <FeedResultsTable />
      <p className="text-body leading-relaxed">
        Here is the attached reference beside the current file. The gallery keeps one row height
        while each image retains its own proportions.
      </p>
      <FeedImages />
      <blockquote className="border-l-2 pl-4 text-body leading-relaxed text-muted-foreground">
        “Keep the active Session and its work visible while composing.”
      </blockquote>
      <div className="space-y-2 text-body leading-relaxed">
        <h3 className="font-medium">What changed</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>Attachments stay in a single, scrollable row.</li>
          <li>Long file names truncate without hiding the remove control.</li>
          <li>Tool results open beside the conversation.</li>
        </ul>
      </div>
      <details className="text-control">
        <summary className="cursor-pointer text-muted-foreground">Review notes</summary>
        <div className="space-y-3 pt-3 text-body leading-relaxed">
          <p>
            The old <s>wrapping attachment grid</s> is now a <strong>single tray</strong>. The draft
            stays <em>editable</em> throughout.
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Attach one image.</li>
            <li>Add nine more files.</li>
            <li>Scroll the tray, then send the Turn.</li>
          </ol>
          <ul className="space-y-1">
            <li>
              <input
                aria-label="Draft restored"
                type="checkbox"
                checked
                readOnly
                className="mr-2 accent-primary"
              />
              Draft restored
            </li>
            <li>
              <input
                aria-label="Narrow layout review"
                type="checkbox"
                checked={false}
                readOnly
                className="mr-2 accent-primary"
              />
              Narrow layout review
            </li>
          </ul>
        </div>
      </details>
    </FeedTurn>
  )
}

function FeedResultsTable() {
  const rows = [
    { case: 'One attachment', result: 'Fits beside the draft', status: 'Passed' },
    { case: 'Ten attachments', result: 'Scrolls within the tray', status: 'Passed' },
    { case: 'Narrow window', result: 'Controls stay visible', status: 'Passed' },
  ]
  return (
    <div className={`overflow-x-auto border ${FEED_CARD_RADIUS_CLASS}`}>
      <table className="w-full text-left text-control">
        <caption className="sr-only">Composer layout checks</caption>
        <thead className="bg-surface-inset">
          <tr>
            {['Case', 'Behavior', 'Result'].map((title) => (
              <th key={title} className="px-3 py-2 font-medium">
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.case} className="border-t">
              <td className="whitespace-nowrap px-3 py-2">{row.case}</td>
              <td className="px-3 py-2 text-muted-foreground">{row.result}</td>
              <td className="px-3 py-2">{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
