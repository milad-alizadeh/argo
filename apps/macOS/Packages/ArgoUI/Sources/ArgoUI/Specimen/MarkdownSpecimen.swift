import SwiftUI

/// One message carrying every block, at the measure the feed reads at.
struct MarkdownSpecimen: View {
    var body: some View {
        ScrollView {
            FeedMarkdown(text: MarkdownSpecimen.message)
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
    - A fence Argo has no grammar for is drawn as it arrived:

    ```mermaid
    graph TD
      A --> B
    ```
    """
}
