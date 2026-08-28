import Foundation

/// The diagrams a reviewer and CI actually look at — the shapes of graph a layered layout has to
/// get right (#861), the shapes of exchange a sequence layout has to (#862) and the shapes of tree
/// a mindmap has to (#867), each written the way an agent really writes one.
///
/// Fences and not models: a specimen that built a `MermaidFlowchart` by hand would prove the layout
/// and skip the reader, and the reader is half of what each of them added.
enum MermaidSpecimen {
    /// Four ranks, every node shape, all four link kinds and a word on an edge in both of its
    /// spellings — one screen carrying everything a reader has to be able to tell apart.
    nonisolated static let flowchart = """
    The route a ticket takes, end to end:

    ```mermaid
    graph TD
      Start([A ticket lands]) --> Read[Read the body]
      Read --> Kind{Which kind?}
      Kind -->|design| Design[[design-to-code]]
      Kind -- code --> Build[[implement]]
      Design -.-> Review((Review))
      Build ==> Review
      Review --> Store[(The record)]
      Review --- Note>Not yet gated]
    ```
    """

    /// A `subgraph` around exactly its members, and a node outside it the frame must not close
    /// over.
    nonisolated static let subgraphs = """
    Where the work happens, and what it hands on:

    ```mermaid
    flowchart LR
      subgraph Reading
        Source --> Model
        Model --> Ranks
      end
      Ranks --> Plan
      Plan --> View
      Plan --> Minimap
    ```
    """

    /// A graph that loops. It has to lay out rather than hang, and lose no edge doing it.
    nonisolated static let cycle = """
    The loop a review really runs in:

    ```mermaid
    graph TD
      Build --> Review
      Review -->|changes| Build
      Review -->|approved| Land
      Land --> Build
    ```
    """

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

    /// Three branches and four levels, indented at a width that CHANGES on the way down — which is
    /// what says the nesting came from the columns rather than from a divisor. Two nodes carry a
    /// break, one carries an icon and one a class (#867).
    nonisolated static let mindmap = """
    How a mermaid fence becomes a diagram:

    ```mermaid
    mindmap
      root((Argo))
        Reading
            Source text
            Model
              Nodes and edges
        Layout
          Ranks
          Routes
            Elbows and<br/>arrowheads
        Drawing
          ::icon(fa fa-pen)
          One canvas
          Real Text<br/>over it
          The overview lane
          :::urgent
    ```
    """

    /// Every figure a mindmap node can be drawn as, beside the others it has to be told apart from
    /// — the pair a reader has to distinguish at a glance is the bang and the cloud.
    nonisolated static let mindmapShapes = """
    The shapes a mindmap spells:

    ```mermaid
    mindmap
      root((Circle))
        a[Square]
        b(Rounded)
        c))Bang((
        d)Cloud(
        e{{Hexagon}}
    ```
    """
}
