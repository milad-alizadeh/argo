/// Which transcripts are held read WHOLE, and what holding them costs.
///
/// A sweep opens every transcript in the working set on a bounded read of its two ends
/// (`TranscriptExcerpt`). The whole file is read when the reader SELECTS the Session, and it stays
/// read afterwards, so clicking back onto a Session is a lookup rather than a second drain of its
/// file. That is the cache; this is its ceiling.
///
/// Bounded twice, because a count alone cannot bound memory (ADR-0028 Rule 4). Twenty readings, so
/// a reader browsing a week's roster does not evict the row they are about to come back to. And an
/// EVENT ceiling under it, because twenty readings are not a fixed size.
///
/// Both numbers come from measurement against real records on the machine this was written on. One
/// 56 MB transcript drained whole takes the process from 42 MB resident to 224 MB — and the second
/// one, 52 MB and 8 574 events more, adds five. So what a HELD reading costs is about 0.6 KB per
/// event, and the 182 MB is the high-water of the drain itself rather than anything kept. Twenty of
/// the largest transcripts here — 554 MB of file, 94 361 events — settle at 256 MB, which is why
/// the event ceiling is a hundred thousand: it admits exactly that worst case and would evict a
/// worse one. On an ordinary week's set, where twenty readings measured nearer 29 000 events, the
/// COUNT is what binds and the event ceiling never fires.
///
/// Events rather than file bytes, because a file's bytes do not say how many events are in it: the
/// largest transcripts here carry one event per 5.9 KB and the week as a whole one per 2.3 KB.
///
/// What this does NOT bound is that 182 MB high-water: `FileCursor.drain` reads a whole file into
/// memory in one `readToEnd`, so a deferred drain of a large transcript peaks at roughly three
/// times
/// its size whatever this holds. A streaming read is the fix and it is its own ticket, not this
/// ceiling's job.
///
/// Evicted OLDEST first, one at a time, and never `removeAll`: an evicted reading falls back to its
/// two ends rather than leaving the roster, so what eviction costs is a re-drain on the next click
/// and never a row.
struct WholeReadings {
    /// Twenty, which is what the reader asked for and what a week-wide roster makes reasonable: at
    /// four, browsing six Sessions re-drained two of them.
    static let capacity = 20
    /// A hundred thousand events — the twenty largest transcripts on the machine above, and half of
    /// what the whole week holds. Stated in events because that is what a held reading is made of.
    static let eventCapacity = 100_000

    /// The transcripts held whole, oldest first — which is the eviction order.
    private(set) var ids: [String] = []

    func holds(_ transcriptID: String) -> Bool {
        ids.contains(transcriptID)
    }

    /// Admit one transcript, and answer which readings must go back to their two ends to make room
    /// for it. Empty where nothing has to go, which is every click until a ceiling is reached.
    ///
    /// Re-admitting one already held moves it to the back and evicts nothing: it is the same
    /// reading, freshly asked for.
    mutating func admit(_ transcriptID: String, eventsHeld: [String: Int]) -> [String] {
        ids.removeAll { $0 == transcriptID }
        ids.append(transcriptID)
        var evicted: [String] = []
        while ids.count > Self.capacity || Self.events(of: ids, held: eventsHeld) > Self
            .eventCapacity {
            // Never the one just admitted: evicting the Session the reader has this moment opened
            // would drain its file and then throw the reading away.
            guard let oldest = ids.first, oldest != transcriptID else { break }
            ids.removeFirst()
            evicted.append(oldest)
        }
        return evicted
    }

    /// Forget one, because its transcript left the set. Not an eviction: there is nothing to fall
    /// back to.
    mutating func drop(_ transcriptID: String) {
        ids.removeAll { $0 == transcriptID }
    }

    private static func events(of ids: [String], held: [String: Int]) -> Int {
        ids.reduce(0) { $0 + (held[$1] ?? 0) }
    }
}
