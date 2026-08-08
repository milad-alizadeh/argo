import ArgoEngine

/// The agent's live to-do list, as the pill above the dock reads it.
///
/// Every value on it is DERIVED from the one list the record carries — where the agent says it is,
/// how far it has got, how many steps there are. None of it is stored, and none of it is invented:
/// a plan that marks nothing in progress has no current step, and this says so rather than
/// nominating the next pending one.
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

    /// The reading of one list, which is the only way a reading is built. Numbering the entries is
    /// the whole of it — a plan arrives complete, so there is nothing here to merge into.
    init(entries: [PlanEntry]) {
        self.steps = entries.enumerated().map { position, entry in
            Step(id: position, text: entry.text, status: entry.status)
        }
    }

    /// The step the agent says it is on, or `nil` when the list names none.
    ///
    /// The FIRST one marked, not the only one: a plan may carelessly mark two, and what the pill
    /// asks is which step is current rather than how many claim to be.
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

    /// How much of the list is behind the agent, `0...1`. What the pill's ring is drawn from, and
    /// the one reading that stays honest when no step is in progress — a finished plan is full and
    /// an untouched one is empty, neither of which needs a current step to say.
    ///
    /// The projection never hands over a reading with no steps, but the initialiser above does not
    /// forbid one — so the empty case is answered here rather than assumed away.
    var progress: Double {
        steps.isEmpty ? 0 : Double(completed) / Double(count)
    }
}
