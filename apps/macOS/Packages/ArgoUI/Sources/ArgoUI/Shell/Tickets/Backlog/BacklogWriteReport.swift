import ArgoEngine

/// What a write over many Tickets left behind (#1247): which ones the provider refused, and why.
///
/// **Nothing is rolled back.** The Tickets that changed keep the new state — a provider that took
/// a write has no undo Argo may assume, and unwriting one to make a batch look atomic would be a
/// second write nobody asked for. So the report is the whole of what the reader is owed: which
/// Tickets did not move, in their own numbers, with the provider's own sentence beside each.
struct BacklogWriteReport: Identifiable, Equatable {
    /// One Ticket the provider would not write, and the reason it gave.
    struct Refusal: Equatable {
        let number: Int
        let reason: String
    }

    /// What was being done, as the menu item said it — so the prompt names the act the reader
    /// pressed rather than a verb Argo chose afterwards.
    let verb: String
    let refusals: [Refusal]

    /// Keyed on what it covers, so a second batch redraws one prompt rather than stacking two.
    var id: String {
        "\(verb)\u{1F}\(refusals.map { "\($0.number)" }.joined(separator: ","))"
    }

    var title: String {
        refusals.count > 1
            ? "\(refusals.count) Tickets were not changed"
            : "One ticket was not changed"
    }

    /// The numbers and the reasons, one line each, under a sentence saying the rest DID change —
    /// which is the load-bearing half: a reader who does not know that will press the menu again
    /// and write the ones that landed twice.
    var message: String {
        let lines = refusals.map { "#\($0.number) — \($0.reason)" }
        return "\(verb) did not reach these. Everything else in the selection changed."
            + "\n\n" + lines.joined(separator: "\n")
    }
}
