/// Which transcripts are held read WHOLE, and what holding them costs.
///
/// A sweep opens every transcript in the working set on a bounded read of its two ends
/// (`TranscriptExcerpt`). The whole file is read when the reader SELECTS the Session, and it stays
/// read afterwards, so clicking back onto a Session is a lookup rather than a second drain of its
/// file. That is the cache; this is its ceiling.
///
/// Bounded twice, because a count alone cannot bound memory (ADR-0028 Rule 4) — by readings and by
/// the events under them. `ReadingCeilings` holds both numbers and the measurement behind them.
///
/// Evicted OLDEST first, one at a time, and never `removeAll`: an evicted reading falls back to its
/// two ends rather than leaving the roster, so what eviction costs is a re-drain on the next click
/// and never a row.
struct WholeReadings {
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
        while ids.count > ReadingCeilings.readings
            || Self.events(of: ids, held: eventsHeld) > ReadingCeilings.events {
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
