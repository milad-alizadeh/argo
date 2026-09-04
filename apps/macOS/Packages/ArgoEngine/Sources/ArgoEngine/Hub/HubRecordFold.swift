/// Which records one reading has already folded — what keeps a file read TWICE from being counted
/// twice (#1204). `HubJoin.add` keeps the reading of a transcript already in the set, so a
/// re-tailed transcript hands the same records to the same reading again; only `HubJoin.reread`
/// drops one. RECORDS and not calls: a repeat is skipped whole, so the spend, the Turns and the
/// calls inside it stay the one fact they always were.
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
    /// with everything up to the next identity — every event a message record carries, since
    /// `TranscriptReader` always emits its identity first — and one already held skips the same
    /// stretch.
    ///
    /// A record the host writes with no uuid at all is never inside that window: it is its own
    /// line, and the identity that opened the standing window belongs to a DIFFERENT record. A
    /// re-tail resends its file's past and then keeps going live, so riding a stale window would
    /// silently drop the first fresh one of these that lands right after — a title renamed, a
    /// stance cycled. Always admitted instead; every reader of them is latest-wins or sticky-true
    /// (`HubSession.apply`, `SessionModeSet`), so the remaining risk — a literal repeat landing
    /// twice — cannot move anything.
    mutating func admits(_ event: TranscriptEvent) -> Bool {
        switch event {
        case let .recordIdentity(uuid):
            isRefolding = !folded.insert(uuid).inserted
            return !isRefolding
        // The seam a bounded read leaves is a fact about the READING and not about any record, so
        // it is never skipped: an extent that has degraded may never read whole again. The rest
        // are the host's own uuid-less lines, per the doc above.
        case .excerpted, .headLeaf, .title, .queued, .mode:
            return true
        // `.interrupted` sits with `.prompt` because it IS one: `HarnessRecord` reads the
        // interrupt marker off a message record's user entry and emits this in its place (#1189),
        // so it arrives inside that record's own window like every other line below.
        case .originSession, .cwd, .model, .effort, .branch, .entry, .prompt, .interrupted,
             .message, .thought, .skillLoaded, .toolCall, .toolCallOutcome, .turnEnded, .usage,
             .plan, .compaction, .unreadableLine:
            return !isRefolding
        }
    }
}
