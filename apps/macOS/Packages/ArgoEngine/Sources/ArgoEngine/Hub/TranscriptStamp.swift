/// A Session's transcript, as one value two reads of it can be compared by without walking it.
///
/// Three counters rather than a hash, on `HubRosterStamp`'s reasoning: a stamp is only honest if it
/// moves whenever the thing it stands for does, and a hash of a stream costs the walk it replaces.
/// Every one of them only ever RISES, so no two of them can move and cancel.
///
/// The lengths alone would be a complete detector while the streams are append-only, which is what
/// `SessionsRoomReadingCache.Stamp` already relies on. `writes` is what stops that being an
/// invariant somebody has to keep: any write at all moves it, appending or not.
public struct TranscriptStamp: Equatable, Sendable {
    private var writes = 0
    private var events = 0
    private var subagentEvents = 0

    public init() {}

    /// The stamp for a stream assembled outside the engine — a fixture, a preview, a test. Its two
    /// lengths and no write history, because there was none: a stream built by hand carrying the
    /// DEFAULT stamp would compare equal to every other one, whatever it held.
    public init(events: [TranscriptEvent], subagentEvents: [String: [TranscriptEvent]]) {
        self.events = events.count
        self.subagentEvents = subagentEvents.values.reduce(0) { $0 + $1.count }
    }

    mutating func wrote(events: Int, subagentEvents: Int) {
        writes &+= 1
        self.events = events
        self.subagentEvents = subagentEvents
    }

    /// The whole write history of a stream merged into this one, added to this one's — see
    /// `TranscriptStream.merge`.
    mutating func fold(_ continuation: TranscriptStamp) {
        writes &+= continuation.writes
    }
}
