/// What a record's `usage` object came to (#1249).
///
/// Two cases and an OPTIONAL around it, because they answer two different questions and neither
/// folds the other: `nil` is "the record carried no `usage` at all", and `unreadable` is "it
/// carried one, and named no token field this reader knows". Only the second is a fact about the
/// window, and only the second is a word on screen. `unreadableLine` is the same shape one level
/// up, for a whole line.
public enum UsageReading: Sendable, Equatable {
    /// An object naming no token field this reader knows. The host's keys moved, or this is not
    /// the shape a spend is written in.
    case unreadable
    /// The spend the object reported. Its terms may be zero — a record the CLI wrote itself is
    /// priced at nothing, and that is a reading rather than a gap.
    case read(Usage)

    /// The spend where one was read, and `nil` where the object could not be read. What a caller
    /// that only sums tokens needs; the two are told apart by matching the cases.
    public var usage: Usage? {
        guard case let .read(usage) = self else { return nil }
        return usage
    }

    /// The four keys a spend is written under, and `nil` for a record that carried no object at
    /// all. A reading is `unreadable` when the object names none of them: a `usage` Argo can read
    /// one term off is a spend with the rest at zero, and a `usage` it can read no term off is not
    /// a spend at all.
    init?(reported: JSONValue?) {
        guard let reported, reported.object != nil else { return nil }
        let input = reported["input_tokens"]?.int
        let output = reported["output_tokens"]?.int
        let cacheRead = reported["cache_read_input_tokens"]?.int
        let cacheCreation = reported["cache_creation_input_tokens"]?.int
        guard input != nil || output != nil || cacheRead != nil || cacheCreation != nil else {
            self = .unreadable
            return
        }
        self = .read(Usage(
            inputTokens: input ?? 0,
            outputTokens: output ?? 0,
            cacheReadTokens: cacheRead ?? 0,
            cacheCreationTokens: cacheCreation ?? 0,
        ))
    }
}
