import Foundation

/// The diagrams a reviewer and CI actually look at, each written the way an agent really writes
/// one. The shapes of graph a layered layout has to get right are here (#861); every other diagram
/// type brings its own file, because the list grows once per type and this one would otherwise be
/// the only file in the tree that every mermaid ticket edits.
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
}
