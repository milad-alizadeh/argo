import ArgoEngine

public extension CockpitPresentation.Session.Chain {
    /// Where a Session's work is against a handoff RIGHT NOW, and where it went if one landed
    /// (`CONTEXT.md` L2) — grouped so `Chain.init` stays inside the house's own parameter cap
    /// (#755, #1327): a handoff running, the ones that failed, and the one that landed are three
    /// readings of the one act. Its own file, beside `CockpitPresentation+SessionValues.swift`
    /// rather than nested in it, for the reason every split there is: the house caps a file at 175
    /// lines and raises the number for no file (`rules/swift.md`).
    ///
    /// Each field keeps the engine's own name for its fact, on the same ground the rest of `Chain`
    /// does (`swift-boundaries.sh` edge 5).
    struct Handoff: Equatable, Sendable {
        /// The Session this one's work is now carried by, once a handoff has landed.
        public let handedOffTo: String?
        /// Whether Argo is running `/handoff` here right now — DIRECT, off the engine's own fact
        /// of the same name. What the header button and the plinth both read.
        public let handingOff: Bool
        /// The handoffs Argo attempted here that did NOT land, oldest first — each drops a failed
        /// row into the reading. Empty for every Session that never tried one, or whose only
        /// attempt landed.
        public let handoffFailures: [SessionWaitSettled]

        public init(
            handedOffTo: String? = nil,
            handingOff: Bool = false,
            handoffFailures: [SessionWaitSettled] = [],
        ) {
            self.handedOffTo = handedOffTo
            self.handingOff = handingOff
            self.handoffFailures = handoffFailures
        }
    }
}
