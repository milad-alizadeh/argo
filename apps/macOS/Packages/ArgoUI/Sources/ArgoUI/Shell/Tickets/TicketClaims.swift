/// The claim join as the views take it: which tickets live Sessions hold, and whether that set is
/// the whole answer (#894).
///
/// The two travel together because counting the first without the second is the false zero: a
/// Session Argo could not join holds a ticket nobody can name, and a count that quietly dropped it
/// says "nothing is in progress" about a machine with an agent running on it.
struct TicketClaims: Equatable, Sendable {
    let numbers: Set<Int>
    /// False where any LIVE Session's own link could not be read, which makes the count absent
    /// rather than short (`CONTEXT.md` degrade-down).
    let areWhole: Bool
}
