import ArgoUI
import Foundation

/// The shapes of exchange a sequence layout has to get right (#862).
extension MermaidSpecimen {
    /// A plain exchange: three participants, an alias, an `actor`, and every arrow form beside the
    /// others it has to be told apart from (#862).
    nonisolated static let sequence = """
    What happens when a ticket is picked up:

    ```mermaid
    sequenceDiagram
      actor Dev
      participant Argo
      participant CI as The runner
      Dev->>Argo: implement 862
      Argo->>CI: open the PR
      CI-->>Argo: checks green
      Argo-)Dev: PR is up
      CI-xArgo: flake on retry
      Argo->Dev: nothing to say
    ```
    """

    /// Activations and notes: bars in both spellings, a run inside a run, and a note in each of the
    /// three placements.
    nonisolated static let sequenceRuns = """
    Who is busy, and what is worth saying about it:

    ```mermaid
    sequenceDiagram
      participant Reader
      participant Layout
      Note left of Reader: a fence arrives
      Reader->>+Layout: the model
      Layout->>Layout: rank the nodes
      Note over Layout: measured at the feed's own metrics
      Layout->>+Layout: route the edges
      Layout-->>-Layout: done
      Layout-->>-Reader: the plan
      Note right of Reader: drawn, and mapped
    ```
    """

    /// Nested blocks: an `alt` with an `else`, a `loop` inside it, and an `opt` after — the shape a
    /// frame has to get right or it closes over a lifeline it does not own.
    nonisolated static let sequenceBlocks = """
    The review, as it really branches:

    ```mermaid
    sequenceDiagram
      participant Author
      participant Review
      participant Land
      alt findings
        Review->>Author: changes requested
        loop until clean
          Author->>Review: another push
        end
      else approved
        Review->>Land: merge it
      end
      opt the branch is stale
        Land->>Author: rebase first
      end
    ```
    """
}
