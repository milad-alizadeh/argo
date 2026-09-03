import Foundation
import ProseText

/// The messages themselves: a line between two lifelines, the mark at its far end, and the word
/// written above it.
///
/// A self-message is the one that is not a line between two: it loops out of its own lifeline and
/// back, which is the only way to draw a call that never leaves its column without the arrow
/// vanishing into the line it started on.
enum MermaidThreads {
    static func drawn(
        _ stage: MermaidStage,
        activations: MermaidActivations,
    )
        -> (figures: [MermaidFigure], captions: [MermaidCaption]) {
        var figures: [MermaidFigure] = []
        var captions: [MermaidCaption] = []
        for (at, event) in stage.diagram.events.enumerated() {
            guard case let .message(message) = event else { continue }
            let drawn = drawn(message, at: at, in: Setting(stage, activations))
            figures += drawn?.figures ?? []
            // A message with nowhere to run still takes its caption. Dropping one would slide
            // every later label one place along, and the view places its subviews by position.
            captions.append(drawn?.caption ?? MermaidCaption(
                label: MermaidLabel(
                    text: message.text, face: MermaidMeasure.edgeFace, role: .note,
                ),
                rect: .zero,
            ))
        }
        return (figures, captions)
    }

    /// Everything a sequence diagram's marks are placed against. A value rather than two more
    /// arguments on every function below it.
    struct Setting {
        let stage: MermaidStage
        let activations: MermaidActivations

        init(_ stage: MermaidStage, _ activations: MermaidActivations) {
            self.stage = stage
            self.activations = activations
        }
    }

    private static func drawn(
        _ message: MermaidSequence.Message,
        at index: Int,
        in setting: Setting,
    )
        -> (figures: [MermaidFigure], caption: MermaidCaption)? {
        guard let fromX = setting.stage.x(of: message.from),
              let toX = setting.stage.x(of: message.to)
        else { return nil }
        let words = setting.stage.words(of: message.text)
        let y = setting.stage.rows.line(at: index, under: words.height)
        let offset = setting.activations.offsets[index] ?? (from: 0, to: 0)
        let run = message.from == message.to
            ? loop(from: CGPoint(x: fromX, y: y), offset: offset)
            : straight(from: CGPoint(x: fromX, y: y), to: toX, offset: offset)
        return (
            figures(of: message, along: run),
            caption(of: message, in: setting.stage.rows.top(at: index), along: run),
        )
    }

    /// A message's own marks: the line it runs along, and whatever stands at its far end.
    private static func figures(
        of message: MermaidSequence.Message,
        along run: [CGPoint],
    )
        -> [MermaidFigure] {
        guard let tip = run.last, run.count > 1 else { return [] }
        let line = MermaidFigure(
            form: .path(run),
            role: .edge,
            line: message.stroke == .dotted ? .dotted : .solid,
        )
        return [line] + MermaidArrowMark.figures(
            of: message.head, tip: tip, from: run[run.count - 2],
        )
    }

    /// The word above the line. Centred on a straight run, and standing to the right of a loop
    /// where there is no midpoint to centre on.
    private static func caption(
        of message: MermaidSequence.Message,
        in top: CGFloat,
        along run: [CGPoint],
    )
        -> MermaidCaption {
        let label = MermaidLabel(text: message.text, face: MermaidMeasure.edgeFace, role: .note)
        let size = CGSize(
            width: ceil(ProseMetrics.width(of: message.text, in: MermaidMeasure.edgeFace)),
            height: MermaidSequenceRows.words(of: message.text),
        )
        guard let first = run.first, let last = run.last else {
            return MermaidCaption(label: label, rect: .zero)
        }
        let isLoop = message.from == message.to
        let x = isLoop ? first.x + MermaidMeasure.wordGap : (first.x + last.x - size.width) / 2
        return MermaidCaption(
            label: label,
            rect: CGRect(origin: CGPoint(x: x, y: top), size: size),
            alignment: isLoop ? .leading : .middle,
        )
    }

    /// A straight run between two lifelines, each end standing off its line by whatever bar is on
    /// it.
    private static func straight(
        from start: CGPoint,
        to toX: CGFloat,
        offset: (from: CGFloat, to: CGFloat),
    )
        -> [CGPoint] {
        let direction: CGFloat = toX > start.x ? 1 : -1
        return [
            CGPoint(x: start.x + direction * offset.from, y: start.y),
            CGPoint(x: toX - direction * offset.to, y: start.y),
        ]
    }

    /// A self-message: out of the lifeline, down, and back to it.
    private static func loop(
        from start: CGPoint,
        offset: (from: CGFloat, to: CGFloat),
    )
        -> [CGPoint] {
        let out = start.x + MermaidMeasure.loopOut
        let back = start.y + MermaidMeasure.loopDrop
        return [
            CGPoint(x: start.x + offset.from, y: start.y),
            CGPoint(x: out, y: start.y),
            CGPoint(x: out, y: back),
            CGPoint(x: start.x + offset.to, y: back),
        ]
    }
}
