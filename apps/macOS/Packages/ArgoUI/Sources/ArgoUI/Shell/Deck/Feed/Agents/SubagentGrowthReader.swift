import Foundation

/// Where the roster asks for every Subagent's growth stamp at once — a reader, not the table
/// (#1572, and #858 for why it is a reader).
///
/// The same value `FeedAgentReader` is: it closes over the engine's answer rather than carrying
/// it, so building one reads nothing and a fan-out's batch reaches only the surface that ASKED.
///
/// Equal means "asks the same thing", never "would answer the same" — the rule `FeedAgentReader`
/// states in full, and for the same reason: a closure cannot be compared, and a view holding one
/// would otherwise fail SwiftUI's comparison on every pass.
public struct SubagentGrowthReader: Equatable, Sendable {
    /// A reader with nothing to ask. Every fixture, specimen and suite holds this one.
    public static let unwatched = SubagentGrowthReader()

    private let identity: ObjectIdentifier?
    private let read: @MainActor @Sendable () -> [String: Int]

    /// The shipping reader: `source` is the object the closure asks, and two readers on one source
    /// are the same reader however many times the shell rebuilds the closure.
    ///
    /// `package`, with the type above `public`: the property this lands on is public because every
    /// surface holds a `CockpitPresentation`, and the answer it gives is the package's own value.
    package init(
        asking source: AnyObject,
        growth: @escaping @MainActor @Sendable () -> [String: Int],
    ) {
        self.identity = ObjectIdentifier(source)
        self.read = growth
    }

    private init() {
        self.identity = nil
        self.read = { [:] }
    }

    /// The table, asked for now. Taken ONCE per pass by the surface that draws it — never per row,
    /// and never inside a walk.
    @MainActor
    package func growth() -> SubagentGrowth {
        SubagentGrowth(lastGrewAtMs: read())
    }

    public static func == (lhs: SubagentGrowthReader, rhs: SubagentGrowthReader) -> Bool {
        lhs.identity == rhs.identity
    }
}
