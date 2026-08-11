/// Reconciling the two things that can say what rung a Session stands on: the one Argo put it on,
/// and the one its record last wrote (ADR-0025). They disagree often enough to be their own read.
public extension HubSession {
    /// The Session's standing stance, as Argo can state it.
    var mode: SessionModeReading {
        guard let modeSet else {
            return observedMode.map(ClaudePermissionMode.reading(of:)) ?? .unknown(cli: nil)
        }
        // The record has not moved since Argo set the rung, and `claude` writes its stance only at
        // Turn boundaries — so the rung Argo put the Session on is the later fact of the two.
        guard modeSet.observedWhenSet != observedMode, let observedMode else {
            return .exactly(modeSet.mode, cli: ClaudePermissionMode.value(for: modeSet.mode))
        }
        // The record moved, so it is what is true — except for Plan, which no CLI can report: it
        // reports Read Only's boundary either way, and the intent is knowable only from the set.
        guard modeSet.mode == .plan, observedMode == ClaudePermissionMode.value(for: .plan) else {
            return ClaudePermissionMode.reading(of: observedMode)
        }
        return .exactly(.plan, cli: observedMode)
    }
}
