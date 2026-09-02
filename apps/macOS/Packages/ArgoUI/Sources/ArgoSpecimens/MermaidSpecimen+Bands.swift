import ArgoUI
import Foundation

/// The banded diagrams: a journey and a timeline, which are one layout and so are looked at
/// together (#866).
extension MermaidSpecimen {
    /// A journey with a band on each side of the day, a task rated at each end of mermaid's scale,
    /// and one task naming three actors — the row a chip stack has to lay out without overlap
    /// (#866).
    nonisolated static let journey = """
    How a ticket actually feels to build:

    ```mermaid
    journey
      title A day on the mermaid epic
      section Morning
        Read the ticket: 4: Me
        Rebase on main: 1: Me, Argo
        Write the reader: 5: Me, Argo, CI
      section Afternoon
        Wait on CI: 2: CI
        Land it: 5: Me
    ```
    """

    /// A sectioned timeline whose middle period carries three events, beside periods carrying one
    /// and none — the stack a band has to reserve room for whichever column asked for it.
    nonisolated static let timeline = """
    How the feed learned to draw:

    ```mermaid
    timeline
      title A history of the feed
      section Before
        2023 : Grey monospace
        2024 : Syntax colour : A minimap lane : Pipe tables
      section After
        2025 : Flowcharts
        2026
    ```
    """

    /// The timeline that names no band at all. Every period keeps one unnamed band, and nothing
    /// draws a strip over it.
    nonisolated static let timelinePlain = """
    What landed, in order:

    ```mermaid
    timeline
      2002 : LinkedIn
      2004 : Facebook : Google
      2006 : Twitter
    ```
    """
}
