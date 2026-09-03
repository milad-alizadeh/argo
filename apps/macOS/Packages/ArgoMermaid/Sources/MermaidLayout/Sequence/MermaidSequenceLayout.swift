import Foundation

// A sequence diagram placed. A different shape of layout from the flowchart's and deliberately so:
// there is no ranking and no ordering pass, because the source already stated the order. Columns
// across for the participants, a time axis down, and every mark placed against those two.
//
// It produces the very same `MermaidPlan`, drawn by the very same view and mapped by the very same
// lane — which is the whole claim of #859's spine, tested here for the first time by a second
// diagram type actually using it.

extension MermaidSequence {
    var laid: MermaidPlan {
        guard !participants.isEmpty else { return .empty }
        let stage = MermaidStage(self)
        let activations = MermaidActivations.of(stage)
        let frames = MermaidFrames.drawn(stage)
        let threads = MermaidThreads.drawn(stage, activations: activations)
        let notes = MermaidNotes.drawn(stage)
        return MermaidPlan(
            // In the order they are drawn over each other: a frame is behind everything it
            // contains, a bar stands on its lifeline, and a note covers whatever it is written
            // over.
            figures: frames.figures + stage.lifelines + Self.bars(activations)
                + stage.heads + threads.figures + notes.figures,
            // In `labels`' own order — participants, messages, notes, frames — which is the
            // pairing `MermaidLayout` places its subviews by.
            captions: stage.names + threads.captions + notes.captions + frames.captions,
            size: CGSize(width: stage.columns.width, height: stage.rows.foot),
        ).normalised
    }

    /// The activation bars. A bar is a container and takes the container's ground, which is what
    /// stops the lifeline behind it reading through the run standing on it.
    private static func bars(_ activations: MermaidActivations) -> [MermaidFigure] {
        activations.bars.map { MermaidFigure(form: .shape(.rect, $0)) }
    }
}
