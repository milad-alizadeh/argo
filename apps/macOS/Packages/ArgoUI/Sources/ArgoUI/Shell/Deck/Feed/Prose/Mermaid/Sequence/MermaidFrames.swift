import Foundation

/// The labelled frames a `loop`, `alt`, `opt`, `par` or `critical` is drawn as: a box around
/// everything between the keyword and its `end`, spanning exactly the lifelines that block touches.
///
/// Read off the flat event list with a stack, which is what makes nesting fall out rather than be
/// handled: an inner block opens after its outer one and closes before it, so the stack alone says
/// which frame each event belongs to and how deep it is.
@MainActor
enum MermaidFrames {
    static func drawn(_ stage: MermaidStage)
        -> (figures: [MermaidFigure], captions: [MermaidCaption]) {
        var walk = MermaidFrameWalk(stage: stage)
        for (at, event) in stage.diagram.events.enumerated() {
            walk.step(event, at: at)
        }
        walk.closeRest()
        let frames = walk.frames.sorted { $0.opened < $1.opened }
        return (
            frames.flatMap(\.figures),
            // In the order the events opened and divided them, which is the order `frameTitles`
            // lists them and the pairing the view rests on.
            frames.flatMap(\.captions).sorted { $0.at < $1.at }.map(\.caption),
        )
    }
}

/// One frame, placed: its own box, and a rule across it at each divider.
@MainActor
struct MermaidFrame {
    let opened: Int
    let figures: [MermaidFigure]
    /// Each word this frame writes, and the event that wrote it — which is what puts every frame's
    /// captions back into source order once the frames themselves are out of it.
    let captions: [(at: Int, caption: MermaidCaption)]
}

/// A block still open: where it started, which lifelines it has touched, and where its dividers
/// fell.
struct MermaidOpenFrame {
    let opened: Int
    let depth: Int
    var columns: ClosedRange<Int>?
    var dividers: [Int] = []

    mutating func touch(_ columns: [Int]) {
        guard let low = columns.min(), let high = columns.max() else { return }
        guard let known = self.columns else {
            self.columns = low ... high
            return
        }
        self.columns = min(known.lowerBound, low) ... max(known.upperBound, high)
    }
}
