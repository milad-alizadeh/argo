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
        case pie(MermaidPie)
        case state(MermaidState)
        case quadrant(MermaidQuadrant)
        case journey(MermaidJourney)
        case timeline(MermaidTimeline)
        /// A class diagram and an entity diagram alike: compartmented boxes joined by annotated
        /// relationships. ONE case for two `mermaid` types, because once the boxes are compartments
        /// and the ends are terminals nothing is left to tell them apart — they differ only in the
        /// reader that stated it (#865).
        case compartmented(MermaidCompartmented)
        case gantt(MermaidGantt)
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
        if let pie = MermaidPie.read(source) {
            return MermaidDiagram(source: source, kind: .pie(pie))
        }
        if let state = MermaidState.read(source) {
            return MermaidDiagram(source: source, kind: .state(state))
        }
        if let quadrant = MermaidQuadrant.read(source) {
            return MermaidDiagram(source: source, kind: .quadrant(quadrant))
        }
        if let journey = MermaidJourney.read(source) {
            return MermaidDiagram(source: source, kind: .journey(journey))
        }
        if let timeline = MermaidTimeline.read(source) {
            return MermaidDiagram(source: source, kind: .timeline(timeline))
        }
        if let classes = MermaidClass.read(source) {
            return MermaidDiagram(source: source, kind: .compartmented(classes))
        }
        if let entities = MermaidEntity.read(source) {
            return MermaidDiagram(source: source, kind: .compartmented(entities))
        }
        if let gantt = MermaidGantt.read(source) {
            return MermaidDiagram(source: source, kind: .gantt(gantt))
        }
        return nil
    }

    /// The captions the diagram sets, in the order its plan places them. Width-independent, because
    /// the view builds one `Text` per label before SwiftUI has told it a measure.
    ///
    /// `@MainActor` because a Gantt chart's are: which dates its axis is marked at is a question
    /// about how wide the words on them RUN, and nothing here measures words off the main actor.
    @MainActor var labels: [MermaidLabel] {
        switch kind {
        case let .flowchart(flowchart): flowchart.labels
        case let .sequence(sequence): sequence.labels
        case let .mindmap(mindmap): mindmap.labels
        case let .pie(pie): pie.labels
        case let .state(state): state.labels
        case let .quadrant(quadrant): quadrant.labels
        case let .journey(journey): journey.labels
        case let .timeline(timeline): timeline.labels
        case let .compartmented(diagram): diagram.labels
        case let .gantt(gantt): gantt.labels
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
        case let .pie(pie): pie.laid
        case let .state(state): state.laid
        case let .quadrant(quadrant): quadrant.laid
        case let .journey(journey): journey.laid
        case let .timeline(timeline): timeline.laid
        case let .compartmented(diagram): diagram.laid
        case let .gantt(gantt): gantt.laid
        }
    }
}
