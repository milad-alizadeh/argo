import ArgoEngine

/// The agent's live to-do list, as the pill above the dock reads it. Every value is DERIVED from
/// the one list the record carries, and none is invented: a plan that marks nothing in progress has
/// no current step rather than the next pending one.
struct PlanReading: Equatable, Sendable {
    /// One entry, addressed by its place in the list.
    struct Step: Identifiable, Equatable, Sendable {
        /// Where it sits, from zero. A list is replaced whole (ADR-0020), so a step's identity is
        /// its position and never its words — two entries worded the same are two steps, and a
        /// reading keyed by text would fuse them.
        let id: Int
        let text: String
        let status: PlanEntryStatus
    }

    let steps: [Step]

    /// A plan arrives complete, so there is nothing here to merge into: numbering is the whole job.
    init(entries: [PlanEntry]) {
        self.steps = entries.enumerated().map { position, entry in
            Step(id: position, text: entry.text, status: entry.status)
        }
    }

    /// The FIRST step marked in progress, not the only one — a plan may carelessly mark two.
    var current: Step? {
        steps.first { $0.status == .inProgress }
    }

    /// Where that step sits, counted the way a reader counts — from one. Absent exactly when the
    /// current step is, so the pill cannot render a position for a step it is not naming.
    var position: Int? {
        current.map { $0.id + 1 }
    }

    var count: Int {
        steps.count
    }

    var completed: Int {
        steps.filter { $0.status == .completed }.count
    }

    /// How much of the list is behind the agent, `0...1` — the one reading that stays honest with
    /// no step in progress. The projection never hands over an empty reading, but the initialiser
    /// does not forbid one, so the empty case is answered rather than assumed away.
    var progress: Double {
        steps.isEmpty ? 0 : Double(completed) / Double(count)
    }
}
