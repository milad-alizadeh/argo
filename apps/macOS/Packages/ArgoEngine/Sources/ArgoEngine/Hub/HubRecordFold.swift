/// Which records one reading has already folded — what keeps a file read TWICE from being counted
/// twice (#1204).
///
/// A tail always re-reads its transcript from the start, and the row it lands in is the one the
/// join already holds: `HubJoin.add` keeps the reading of a transcript already in the set, so a
/// transcript re-tailed hands the same records to the same reading again. Only `HubJoin.reread`
/// drops a reading, and that is the SELECTION path — everywhere else a second read used to be a
/// second of everything: two chips for one delegation, two of every token, two of every Turn.
///
/// RECORDS and not calls, because the duplication is of the record: a repeat is skipped whole, so
/// the spend, the Turns and the calls inside it are all the one fact they always were. Its own
/// value rather than two fields on `HubSession`, so the rule and its state are read together.
struct HubRecordFold: Equatable, Sendable {
    /// Every record uuid this reading has folded.
    private var folded: Set<String> = []
    /// Whether the fold is inside a record it has already read, and is skipping to the next one.
    /// Held rather than asked per event: a record's identity is emitted first and its events after
    /// it (`TranscriptReader.read`), so what follows a repeat is the repeat's own content.
    private var isRefolding = false

    /// Whether this event is one the reading has not folded before.
    ///
    /// A record's uuid opens the window and closes it: an identity never seen is admitted, along
    /// with everything up to the next identity, and one already held skips the same stretch. A
    /// record the host writes without a uuid — a title, a head leaf, a queue operation — has no
    /// identity to be told apart by, so it rides in the window the record before it opened.
    mutating func admits(_ event: TranscriptEvent) -> Bool {
        // The seam a bounded read leaves is a fact about the READING and not about any record, so
        // it is never skipped: an extent that has degraded may never read whole again.
        if case .excerpted = event {
            return true
        }
        guard case let .recordIdentity(uuid) = event else {
            return !isRefolding
        }
        isRefolding = !folded.insert(uuid).inserted
        return !isRefolding
    }
}
