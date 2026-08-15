/// What a Session has been billed, at both the grains `CONTEXT.md` L3 names: what its own records
/// priced, and what a delegating call reported for the Subagent it ran.
///
/// Every one of these is an ADDITION that must not be able to invent a number: an absent half
/// leaves the other exactly as it was, and two absences stay absent.
struct SessionSpend: Equatable, Sendable {
    /// Both grains together, which is what the Session as a whole cost.
    private var total: Usage?
    /// The Subagent half of it, kept apart because the header says it apart.
    private var subagent: Usage?

    /// Cache excluded — that is `cachedTokens`. Absent until a record prices something: a Session
    /// nobody priced has not spent nothing.
    var spentTokens: Int? {
        total?.spentTokens
    }

    /// The cache half of the same life: read and re-read once per request, so it runs to tens of
    /// millions on a long Session while the spend stays small. Absent with `spentTokens`.
    var cachedTokens: Int? {
        total?.cachedTokens
    }

    /// Read off the DELEGATING call's result — the only place that spend is ever reported, since a
    /// sidechain's own records carry none. Absent, never zero: a zero would claim no Subagent ran.
    var subagentTokens: Int? {
        subagent?.billedTokens
    }

    /// What one record priced, which is the Session's own.
    mutating func observe(_ usage: Usage) {
        total = Self.summed(total, usage)
    }

    /// What a delegating call's result reported. It counts TWICE: once on the Subagent line, and
    /// once in the Session total. Nothing reported leaves both absent, never zero.
    mutating func observe(subagent usage: Usage?) {
        guard let usage else { return }
        subagent = Self.summed(subagent, usage)
        total = Self.summed(total, usage)
    }

    /// Spend ADDS across a resume chain, unlike the context reading: a resumed file's tokens were
    /// billed on top of the root's, not instead of them.
    mutating func merge(_ continuation: SessionSpend) {
        total = Self.summed(total, continuation.total)
        subagent = Self.summed(subagent, continuation.subagent)
    }

    private static func summed(_ left: Usage?, _ right: Usage?) -> Usage? {
        guard let left else { return right }
        guard let right else { return left }
        return left + right
    }
}
