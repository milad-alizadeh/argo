import ArgoUI
import Foundation

/// The shapes of tree a mindmap layout has to get right (#867).
extension MermaidSpecimen {
    /// Three branches and four levels, indented at a width that CHANGES on the way down — which is
    /// what says the nesting came from the columns rather than from a divisor. Two nodes carry a
    /// break and one a class; no icon, because Argo ships no icon font to draw one with (#867).
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
          One canvas
          Real Text<br/>over it
          The overview lane
          :::urgent
    ```
    """

    /// Every figure a mindmap node can be drawn as, beside the others it has to be told apart from
    /// — the pair a reader has to distinguish at a glance is the bang and the cloud.
    ///
    /// Those two carry the LONGEST label here, over two lines. Their outline is built on the box's
    /// own ellipse, and the corners of a rect inscribed in one are what leave it first, so the
    /// worst case for `blobScale` is the widest words set over the most lines.
    nonisolated static let mindmapShapes = """
    The shapes a mindmap spells:

    ```mermaid
    mindmap
      root((Circle))
        a[Square]
        b(Rounded)
        c))A bang that<br/>shouts loudly((
        d)A cloud of<br/>loose ideas(
        e{{Hexagon}}
    ```
    """
}
