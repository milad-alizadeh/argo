public extension HubSession {
    /// What the Session has SPENT across its whole life, cache excluded (that is `cachedTokens`).
    /// Absent until a record prices something: a Session nobody priced has not spent nothing.
    var spentTokens: Int? {
        spend?.spentTokens
    }

    /// The cache half of the same life: read and re-read once per request, so it runs to tens of
    /// millions on a long Session while the spend stays small. Absent with `spentTokens`.
    var cachedTokens: Int? {
        spend?.cachedTokens
    }

    /// Read off the DELEGATING call's result — the only place that spend is ever reported, since a
    /// sidechain's own records carry none. Absent, never zero: a zero would claim no subagent ran.
    var subagentTokens: Int? {
        subagentSpend?.billedTokens
    }
}
