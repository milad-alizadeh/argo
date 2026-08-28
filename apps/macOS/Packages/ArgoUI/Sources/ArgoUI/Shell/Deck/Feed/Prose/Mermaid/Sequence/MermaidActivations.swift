import Foundation

/// The bars standing on the lifelines, and where each arrow has to stop because of them.
///
/// Both come out of ONE walk down the events, because they are the same fact asked twice: an arrow
/// lands on the bar of the run it belongs to rather than on the line behind it, so an endpoint
/// cannot be placed without knowing how deep that lifeline is at that moment.
@MainActor
struct MermaidActivations {
    /// Every bar, placed.
    let bars: [CGRect]
    /// Keyed by event: how far the message drawn there stands off each of its two lifelines.
    let offsets: [Int: (from: CGFloat, to: CGFloat)]

    static func of(_ stage: MermaidStage) -> MermaidActivations {
        var walk = Walk(stage: stage)
        for (at, event) in stage.diagram.events.enumerated() {
            walk.step(event, at: at)
        }
        walk.closeRest()
        return MermaidActivations(
            // A stable order, because a dictionary's own is seeded afresh on every launch and the
            // plan is compared for equality.
            bars: walk.bars.sorted { ($0.minY, $0.minX) < ($1.minY, $1.minX) },
            offsets: walk.offsets,
        )
    }

    /// How far off the lifeline an arrow stands where bars are stacked on it. Nesting grows
    /// rightwards, so the left-hand side is the outermost bar's edge whatever the depth and the
    /// right-hand side moves out with it.
    static func offset(depth: Int, rightwards: Bool) -> CGFloat {
        guard depth > 0 else { return 0 }
        let width = MermaidMeasure.activationWidth
        return rightwards ? width / 2 + CGFloat(depth - 1) * width / 2 : width / 2
    }

    /// One bar: the depth it stands at pushes it out of the lifeline, so a run inside a run is
    /// drawn beside its own caller rather than hidden under it.
    private static func bar(x: CGFloat, over run: ClosedRange<CGFloat>, depth: Int) -> CGRect {
        let width = MermaidMeasure.activationWidth
        return CGRect(
            x: x - width / 2 + CGFloat(depth - 1) * width / 2,
            y: run.lowerBound,
            width: width,
            // A run opened and closed on one line is still a mark, not a hairline.
            height: max(run.upperBound - run.lowerBound, width),
        )
    }
}

private extension MermaidActivations {
    /// The walk itself: which lifelines are running, and how deep.
    @MainActor
    struct Walk {
        let stage: MermaidStage
        /// Per participant, the start of every run still open on it, outermost first.
        var open: [String: [CGFloat]] = [:]
        var bars: [CGRect] = []
        var offsets: [Int: (from: CGFloat, to: CGFloat)] = [:]

        mutating func step(_ event: MermaidSequence.Event, at index: Int) {
            switch event {
            case let .activate(name):
                turnOn(name, at: stage.timeline.top(at: index))
            case let .deactivate(name):
                turnOff(name, at: stage.timeline.top(at: index))
            case let .message(message):
                record(message, at: index)
            case .note, .opens, .divides, .closes:
                break
            }
        }

        /// A message's own two ends. The `-` shorthand deactivates the SENDER — `John-->>-Alice` is
        /// John finishing, not Alice — and both ends are measured against the bar the arrow really
        /// touches: the sender's before it closes, the receiver's after it opens.
        mutating func record(_ message: MermaidSequence.Message, at index: Int) {
            let y = stage.timeline.line(at: index, under: stage.words(of: message.text).height)
            let sides = sides(of: message)
            let sender = depth(of: message.from)
            if message.deactivates {
                turnOff(message.from, at: y)
            }
            if message.activates {
                turnOn(message.to, at: y)
            }
            offsets[index] = (
                from: MermaidActivations.offset(depth: sender, rightwards: sides.from),
                to: MermaidActivations.offset(
                    depth: depth(of: message.to),
                    rightwards: sides.to,
                ),
            )
        }

        /// Which side of each lifeline the arrow's two ends stand on. Not one answer reversed: a
        /// self-message loops out to the RIGHT and comes back to the right, so both of its ends are
        /// the right-hand edge rather than one of each.
        func sides(of message: MermaidSequence.Message) -> (from: Bool, to: Bool) {
            guard let from = stage.diagram.column(of: message.from),
                  let to = stage.diagram.column(of: message.to), from != to
            else { return (from: true, to: true) }
            return (from: to > from, to: to < from)
        }

        func depth(of name: String) -> Int {
            open[name]?.count ?? 0
        }

        mutating func turnOn(_ name: String, at y: CGFloat) {
            open[name, default: []].append(y)
        }

        /// The run is popped BEFORE the lifeline is looked up, so a name with no column loses its
        /// run rather than keeping it — `closeRest` loops until the stack empties, and a `turnOff`
        /// that could fail without shrinking it would never return.
        mutating func turnOff(_ name: String, at y: CGFloat) {
            guard var runs = open[name], let start = runs.popLast() else { return }
            open[name] = runs
            guard let x = stage.x(of: name) else { return }
            bars.append(MermaidActivations.bar(
                x: x, over: start ... max(start, y), depth: runs.count + 1,
            ))
        }

        /// A run nobody closed runs to the foot of the diagram, which is what mermaid draws and
        /// what a half-written source most often means.
        mutating func closeRest() {
            for name in open.keys.sorted() {
                while !(open[name] ?? []).isEmpty {
                    turnOff(name, at: stage.timeline.foot)
                }
            }
        }
    }
}
