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
        return (frames.flatMap(\.figures), captions(of: stage.diagram, on: frames))
    }

    /// One caption per event that writes a frame word, in event order — which is exactly what
    /// `frameTitles` lists, asked of the SAME source rather than of the frames that happened to be
    /// placed. A stray divider no frame claimed still takes its caption at no rect: dropping one
    /// would slide every frame label after it onto the wrong rect.
    private static func captions(
        of diagram: MermaidSequence,
        on frames: [MermaidFrame],
    )
        -> [MermaidCaption] {
        let placed = Dictionary(
            frames.flatMap(\.captions).map { ($0.at, $0.caption) },
            uniquingKeysWith: { first, _ in first },
        )
        return diagram.events.indices.compactMap { at in
            guard let title = diagram.frameTitle(at: at) else { return nil }
            return placed[at] ?? MermaidCaption(
                label: MermaidLabel(text: title, face: MermaidMeasure.groupFace, role: .note),
                rect: .zero,
                alignment: .leading,
            )
        }
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
