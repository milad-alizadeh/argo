/// What the Session cost, read off the one value that added it up.
///
/// Every figure here is a sum over the WHOLE record, so every one of them is withheld while the
/// reading is an excerpt: a launch sweep reads two ends of a file, and the total of what it saw is
/// not the total of what was spent (`SessionTranscriptExtent`). Absent is what the header already
/// draws as unread, so degrading down costs no surface anything — and a full drain, which is what
/// selecting the Session takes, answers them all.
public extension HubSession {
    /// Whether a figure summed over the record can be stated at all.
    private var hasWholeReading: Bool {
        transcriptExtent == .whole
    }

    /// What the Session has SPENT across its whole life, cache excluded (that is `cachedTokens`).
    /// Absent until a record prices something: a Session nobody priced has not spent nothing.
    var spentTokens: Int? {
        hasWholeReading ? spend.spentTokens : nil
    }

    /// The cache half of the same life: read and re-read once per request, so it runs to tens of
    /// millions on a long Session while the spend stays small. Absent with `spentTokens`.
    var cachedTokens: Int? {
        hasWholeReading ? spend.cachedTokens : nil
    }

    /// Read off the DELEGATING call's result — the only place that spend is ever reported, since a
    /// sidechain's own records carry none. Absent, never zero: a zero would claim no Subagent ran.
    var subagentTokens: Int? {
        hasWholeReading ? spend.subagentTokens : nil
    }
}
