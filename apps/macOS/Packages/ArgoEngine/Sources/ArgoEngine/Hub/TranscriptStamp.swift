/// A Session's transcript, as one value two reads of it can be compared by without walking it.
///
/// Two counters rather than a hash, on `HubRosterStamp`'s reasoning: a stamp is only honest if it
/// moves whenever the thing it stands for does, and a hash of a stream costs the walk it replaces.
/// Both only ever RISE, so they cannot move and cancel.
///
/// The length alone would be a complete detector while the stream is append-only, which is what
/// `SessionsRoomReadingCache.Stamp` already relies on. `writes` is what stops that being an
/// invariant somebody has to keep: any write at all moves it, appending or not.
public struct TranscriptStamp: Equatable, Sendable {
    private var writes = 0
    private var events = 0

    public init() {}

    /// The stamp for a stream assembled outside the engine — a fixture, a preview, a test. Its
    /// length and no write history, because there was none: a stream built by hand carrying the
    /// DEFAULT stamp would compare equal to every other one, whatever it held.
    public init(events: [TranscriptEvent]) {
        self.events = events.count
    }

    mutating func wrote(events: Int) {
        writes &+= 1
        self.events = events
    }

    /// The whole write history of a stream merged into this one, added to this one's — see
    /// `TranscriptStream.merge`.
    mutating func fold(_ continuation: TranscriptStamp) {
        writes &+= continuation.writes
    }
}
