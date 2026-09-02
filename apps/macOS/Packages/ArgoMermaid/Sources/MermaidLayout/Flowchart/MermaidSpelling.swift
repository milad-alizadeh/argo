import Foundation

/// One way mermaid lets a node's label be bracketed, and the figure those brackets name.
struct MermaidSpelling: Equatable, Sendable {
    let open: String
    let close: String
    let shape: MermaidFlowchart.Shape
}
