import Foundation

/// A `mermaid` fence Argo can draw: the model its own reader made, and the source it was read from.
///
/// The source is kept because the laid-out plan is CACHED on it — see `ProseReading.plan(of:)`.
/// The renderer and the overview lane must read ONE layout, and the text is the only key both of
/// them hold.
///
/// Adding a diagram type is a case here, a reader and a layout. No view, no lane and no theming
/// changes (#859).
struct MermaidDiagram: Equatable, Sendable {
    let source: String
    let kind: Kind

    enum Kind: Equatable, Sendable {
        case flowchart(MermaidFlowchart)
        case sequence(MermaidSequence)
        case mindmap(MermaidMindmap)
    }

    /// The diagram this source draws, or `nil` where nothing here can read it — an unsupported
    /// type, a syntax error, a fence still streaming in. That `nil` is what keeps the block a
    /// fence, and the reason detection is a PARSE: the renderer and the lane read one answer, so
    /// they cannot disagree about what the block is.
    /// Each reader is asked in turn and every one of them owns its own header, so the order here
    /// settles nothing — the first that says yes is the only one that could have.
    static func read(_ source: String) -> MermaidDiagram? {
        if let flowchart = MermaidFlowchart.read(source) {
            return MermaidDiagram(source: source, kind: .flowchart(flowchart))
        }
        if let sequence = MermaidSequence.read(source) {
            return MermaidDiagram(source: source, kind: .sequence(sequence))
        }
        if let mindmap = MermaidMindmap.read(source) {
            return MermaidDiagram(source: source, kind: .mindmap(mindmap))
        }
        return nil
    }

    /// The captions the diagram sets, in the order its plan places them. Width-independent, because
    /// the view builds one `Text` per label before SwiftUI has told it a measure.
    var labels: [MermaidLabel] {
        switch kind {
        case let .flowchart(flowchart): flowchart.labels
        case let .sequence(sequence): sequence.labels
        case let .mindmap(mindmap): mindmap.labels
        }
    }

    /// The diagram laid out. Uncached: callers come through `ProseReading.plan(of:)`, which is the
    /// one layout the renderer and the lane share.
    ///
    /// No measure, and that is a claim rather than an omission: a diagram is as big as the thing it
    /// draws, so it is SCROLLED where the prose column cannot hold it rather than reflowed to fit.
    /// A layout with nothing to reflow against cannot answer two widths two ways, which is what
    /// makes the drawn height and the reported height the same number by construction (#860).
    @MainActor var laid: MermaidPlan {
        switch kind {
        case let .flowchart(flowchart): flowchart.laid
        case let .sequence(sequence): sequence.laid
        case let .mindmap(mindmap): mindmap.laid
        }
    }
}
