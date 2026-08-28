import Foundation

/// A `mermaid` fence Argo can draw: the model its own reader made, and the source it was read from.
///
/// The source is kept because the laid-out plan is CACHED on it — see
/// `ProseReading.plan(of:across:)`. The renderer and the overview lane must read ONE layout, and
/// the text is the only key both of them hold.
///
/// Adding a diagram type is a case here, a reader and a layout. No view, no lane and no theming
/// changes (#859).
struct MermaidDiagram: Equatable, Sendable {
    let source: String
    let kind: Kind

    enum Kind: Equatable, Sendable {
        case flowchart(MermaidFlowchart)
    }

    /// The diagram this source draws, or `nil` where nothing here can read it — an unsupported
    /// type, a syntax error, a fence still streaming in. That `nil` is what keeps the block a
    /// fence, and the reason detection is a PARSE: the renderer and the lane read one answer, so
    /// they cannot disagree about what the block is.
    static func read(_ source: String) -> MermaidDiagram? {
        guard let flowchart = MermaidFlowchart.read(source) else { return nil }
        return MermaidDiagram(source: source, kind: .flowchart(flowchart))
    }

    /// The captions the diagram sets, in the order its plan places them. Width-independent, because
    /// the view builds one `Text` per label before SwiftUI has told it a measure.
    var labels: [MermaidLabel] {
        switch kind {
        case let .flowchart(flowchart): flowchart.labels
        }
    }

    /// The diagram laid out across a measure. Uncached: callers come through
    /// `ProseReading.plan(of:across:)`, which is the one layout the renderer and the lane share.
    @MainActor func laid(across measure: CGFloat) -> MermaidPlan {
        switch kind {
        case let .flowchart(flowchart): flowchart.laid(across: measure)
        }
    }
}
