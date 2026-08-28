import Foundation

/// The pass that turns what a Gantt source WROTE into where its bars really go.
///
/// A pass over the whole read model and not a sweep down it, because `after` may name an id
/// declared below its own line. Each draft is walked to the tasks it waits on, what was settled is
/// kept, and a chain that comes back round to a task already being walked is a CYCLE: unreadable
/// source, so the block stays a fence rather than hanging or half-drawing it.
enum MermaidGanttResolve {
    /// Every draft placed, in the order they were read, or `nil` where one of them cannot be.
    static func tasks(
        of drafts: [MermaidGanttDraft],
        excluding excludes: MermaidGanttExcludes,
    )
        -> [MermaidGantt.Task]? {
        var walk = Walk(drafts: drafts, excludes: excludes)
        var placed: [MermaidGantt.Task] = []
        for at in drafts.indices {
            guard let task = walk.task(at: at) else { return nil }
            placed.append(task)
        }
        return placed
    }
}

private struct Walk {
    private let drafts: [MermaidGanttDraft]
    private let excludes: MermaidGanttExcludes
    /// Where each id was declared, and the ids declared more than once. Which task `after a` meant
    /// is not a thing to guess, so an ambiguous name is a fence — while an id nothing ever waits
    /// on stays as harmless as it was in #903.
    private let declared: [String: Int]
    private let twice: Set<String>
    private var settled: [Int: MermaidGantt.Task] = [:]
    private var walking: Set<Int> = []

    init(drafts: [MermaidGanttDraft], excludes: MermaidGanttExcludes) {
        var declared: [String: Int] = [:]
        var twice: Set<String> = []
        for (at, draft) in drafts.enumerated() where !draft.id.isEmpty {
            if declared.updateValue(at, forKey: draft.id) != nil {
                twice.insert(draft.id)
            }
        }
        self.drafts = drafts
        self.excludes = excludes
        self.declared = declared
        self.twice = twice
    }

    mutating func task(at: Int) -> MermaidGantt.Task? {
        if let settled = settled[at] {
            return settled
        }
        // The cycle refusal, and the whole of it: a draft already on the walk cannot be waiting
        // for itself to finish.
        guard walking.insert(at).inserted else { return nil }
        defer { walking.remove(at) }
        let draft = drafts[at]
        guard let start = begin(draft.begin),
              let end = end(draft.length, from: start), end >= start,
              // A bar too long to be broken around its days off is a chart nothing can render.
              excludes.draws(from: start, to: end),
              // A milestone is a POINT, and only here is that knowable: an `after` and a length
              // counted around the days off both settle at resolution. Given a length the source
              // says two things at once, and drawing the marker at either end drops the other.
              !draft.states.contains(.milestone) || end == start
        else { return nil }
        let placed = MermaidGantt.Task(
            name: draft.name,
            id: draft.id,
            states: draft.states,
            start: start,
            end: end,
        )
        settled[at] = placed
        return placed
    }

    /// The one decision this reading makes about a day off and a start.
    ///
    /// A date the source WROTE is never moved — neither of a task's two ends is, and both halves
    /// of that rule are here and in `MermaidGanttExcludes.end(from:nominally:)`. A written start on
    /// a Saturday stays on the Saturday it says; the bar simply opens where work can, because
    /// `runs` breaks it around the weekend on its own.
    ///
    /// A start this reader DERIVED is the one date it is free to move, because nothing was written
    /// for it to contradict: a task waiting on one that ends on a Saturday opens on the Monday.
    private mutating func begin(_ begin: MermaidGanttDraft.Begin) -> Date? {
        switch begin {
        case let .on(date): date
        case let .after(ids): latest(of: ids).flatMap { excludes.opening(at: $0) }
        }
    }

    /// When the last of the named tasks is done — their REAL ends, which is how exclusions and
    /// `after` compose: the predecessor is placed in full before anything reads its end.
    private mutating func latest(of ids: [String]) -> Date? {
        var latest: Date?
        for id in ids {
            guard !twice.contains(id), let at = declared[id], let waited = task(at: at)
            else { return nil }
            latest = latest.map { Swift.max($0, waited.end) } ?? waited.end
        }
        return latest
    }

    private func end(_ length: MermaidGanttDraft.Length, from start: Date) -> Date? {
        switch length {
        case let .until(date):
            date
        case let .lasting(components):
            MermaidGanttClock.calendar.date(byAdding: components, to: start)
                .flatMap { excludes.end(from: start, nominally: $0) }
        }
    }
}
