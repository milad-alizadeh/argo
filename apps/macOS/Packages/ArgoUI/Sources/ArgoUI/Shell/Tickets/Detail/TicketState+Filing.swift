import ArgoEngine

extension TicketState {
    /// How Argo's bucket is SET beside the provider's own word — lowercase, and spelled as words
    /// rather than as the case name, which would file a ticket under `ruledout`.
    var filing: String {
        switch self {
        case .open: "open"
        case .claimed: "claimed"
        case .resolved: "resolved"
        case .ruledOut: "ruled out"
        }
    }
}
