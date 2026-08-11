import ArgoEngine

/// What each port is called on screen, and what connecting one buys.
///
/// User-side language, not the model's: the panel says what the row will show you, and "Work Item
/// provider" is a phrase from `CONTEXT.md` that nobody outside it has ever said out loud. The
/// benefit line is the payoff stated plainly, which is what onboarding cut the honesty-tier ladder
/// in favour of (#265).
extension AccountPort {
    var readableName: String {
        switch self {
        case .workItem: "Issues and tickets"
        case .codeHost: "Pull requests and CI"
        }
    }

    /// What this row is for, said once, in the place a user decides whether to bother.
    var benefit: String {
        switch self {
        case .workItem: "Connect an account to see your backlog beside your sessions."
        case .codeHost: "Connect an account to see pull requests, reviews and checks."
        }
    }
}
