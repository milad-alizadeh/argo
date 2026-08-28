import Foundation

/// What a source says about a task besides its dates: whether it is finished, in flight, on the
/// critical path, or a milestone rather than a bar.
///
/// A SET and never one value, because mermaid writes `crit, active`. Which is also why `crit` is
/// not a rung of the same scale as `done` and `active`: a rung holds one value, and this holds two.
enum MermaidGanttState: String, Equatable, Sendable {
    case done, active, crit, milestone
}

extension MermaidGanttState {
    /// The states written in front of a task's id and its dates, and the fields left after them.
    ///
    /// `nil` rather than a shrug for a state said twice and for `done, active` together: each says
    /// two things, and dropping one of them draws a chart the source did not write — the phantom
    /// this epic has been caught by more than once. A word that is no state at all ends the run and
    /// is left in `rest`, where it has to be an id or the whole line is refused.
    static func read(leading fields: [String]) -> (states: Set<Self>, rest: ArraySlice<String>)? {
        var states: Set<Self> = []
        var at = fields.startIndex
        while at < fields.endIndex, let state = Self(rawValue: fields[at].lowercased()) {
            guard states.insert(state).inserted else { return nil }
            at = fields.index(after: at)
        }
        guard !(states.contains(.done) && states.contains(.active)) else { return nil }
        return (states, fields[at...])
    }
}

extension MermaidGantt.Task {
    /// A point on the axis rather than a length along it.
    var isMilestone: Bool {
        states.contains(.milestone)
    }

    /// On the critical path. Drawn as a ring round the mark rather than as a hue of its own — see
    /// `MermaidGanttChart.marks` for why, and for which ink.
    var isCritical: Bool {
        states.contains(.crit)
    }

    /// How much of its section's hue the mark is laid down in, which is the WHOLE of the progress
    /// dimension: spent, ordinary, live. One hue at three strengths reads as a scale; three hues
    /// would read as three unrelated categories, which is the thing #905 is against.
    var weight: MermaidFigure.Weight {
        if states.contains(.done) {
            .spent
        } else if states.contains(.active) {
            .full
        } else {
            .ordinary
        }
    }
}
