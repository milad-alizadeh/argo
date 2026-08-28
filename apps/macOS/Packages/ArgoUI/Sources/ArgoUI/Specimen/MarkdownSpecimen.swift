import SwiftUI

/// One message carrying every block, at the measure the feed reads at.
struct MarkdownSpecimen: View {
    var text: String = MarkdownSpecimen.message

    var body: some View {
        ScrollView {
            FeedMarkdown(text: text)
                .padding(ArgoFeedRow.inset)
                .argoFeedMeasure()
        }
        .argoDeckSurface()
    }

    /// Read by the lane's own specimen too — see `FeedProjection.previewMarkdownRows`.
    nonisolated static let message = """
    ## What landed

    `ArgoFeedRow` holds all four metrics, and no view spells a number. The **ramp** had drifted
    navy; `surface.base` was sampled from the old study.

    ```swift
    public static let column: CGFloat = 720
    // The measure is typographic, not a rung of the ladder.
    ```

    | Ticket | Label | Blocked by |
    |---|---|---|
    | #474 — Read each prose string once, not once per frame | `ready-for-agent` | — |
    | #475 — Land seam and panel widths on whole points | `ready-for-agent` | — |
    | #477 — Confirm the deck moves cleanly, in the running app | `ready-for-human` | #474, #475 |

    1. The inset, the gap and the step before prose come off the spacing ladder.
    2. The line height and the measure answer to the type ramp instead.

    - The contract suite asserts every one of them, per [ADR-0021](https://example.com).
    - A fence Argo can read is drawn as the diagram it is:

    ```mermaid
    graph TD
      A --> B
    ```
    """

    /// A diagram Argo reads beside a fence declaring the same grammar it cannot, so both halves of
    /// the bargain are on one screen: what is read is drawn, and what is not is the grey source it
    /// has always been.
    nonisolated static let diagrams = """
    The spine, in the order the data moves:

    ```mermaid
    graph TD
      Reader --> Layout
      Layout --> Plan
      Plan --> View
      Plan --> Minimap
    ```

    A diagram type nothing here can read yet:

    ```mermaid
    pie title Where the time went
      "Reading" : 40
      "Layout" : 35
    ```
    """

    /// Cells that are mostly backticked, at a measure where the mono wraps and the sans would not
    /// — the state a row was placed a line shorter than it drew at (#766). Two rows, so the overlap
    /// lands on words rather than on the table's own foot.
    nonisolated static let codeDenseTable = """
    | claim | check |
    |---|---|
    | #757 four spellings | `answered`/`finished`/`looked`, and a fourth in `FeedFixture.swift` |
    | #750 three gates | `quality:swift`, `quality:duplication`, `test:hooks` — 229/137/195 |
    | #766 two sites | `ProseMetrics.measured` and `ProseMetrics.typeset`, one premise apiece |
    """
}
