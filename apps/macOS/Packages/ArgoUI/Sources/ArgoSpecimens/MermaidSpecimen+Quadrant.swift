import ArgoUI
import Foundation

/// The fields a quadrant layout has to get right (#868).
extension MermaidSpecimen {
    /// A fully labelled field with points clustered in one corner — the pair of failures a unit
    /// test passes and an eye catches: a y axis running the wrong way up, and names drawn over one
    /// another.
    nonisolated static let quadrant = """
    Where the diagram types stand, effort against payoff:

    ```mermaid
    quadrantChart
      title The mermaid epic, ticket by ticket
      x-axis Cheap to build --> Costly to build
      y-axis Rarely written --> Often written
      quadrant-1 Worth the work
      quadrant-2 Do these first
      quadrant-3 Leave for later
      quadrant-4 Hard to justify
      Flowcharts: [0.82, 0.94]
      Sequence: [0.6, 0.78]
      State: [0.66, 0.4]
      Class: [0.7, 0.36]
      ER: [0.73, 0.33]
      Pie: [0.15, 0.55]
      Quadrant: [0.2, 0.5]
      Mindmap: [0.24, 0.46]
      Gantt: [0.5, 0.08]
      Timeline: [0.12, 0.14]
    ```
    """

    /// The edges of the scale and nothing else said about them: a point in each corner and one at
    /// the very centre, which is where a chart is either drawn inside its field or clipped.
    nonisolated static let quadrantEdges = """
    The corners of the scale, plotted:

    ```mermaid
    quadrantChart
      x-axis Nothing --> Everything
      y-axis Never --> Always
      Origin: [0, 0]
      Far: [1, 1]
      Left: [0, 1]
      Right: [1, 0]
      Middle: [0.5, 0.5]
    ```
    """
}
