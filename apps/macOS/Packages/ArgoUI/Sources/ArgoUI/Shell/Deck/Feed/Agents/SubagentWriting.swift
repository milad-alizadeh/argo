import ArgoEngine

/// Whether Argo has watched this Subagent's OWN file grow recently enough to call the delegation
/// live (#1269).
///
/// The evidence the parent's record does not hold. A Session that delegated its children and is now
/// waiting on them writes nothing itself, so its status reads `idle` and every delegation under it
/// is indistinguishable in the record from a dead one's (#1076). Argo holds each child's own
/// transcript anyway (#858), and a file it has watched grow is DIRECT evidence somebody is writing
/// it. Where that reading is applied, and why not one level down, is `FeedAgents.told(_:by:at:)`.
///
/// **One-directional, exactly as `DelegationCeiling` is** — it only ever GIVES a running claim, on
/// the evidence of a write. It never reopens a delegation the record answered: that ending is one
/// Argo holds, and a trailing byte in the child's file does not un-answer it.
///
/// **What it does NOT decay is stated here rather than left to be found.** A chip lifted to running
/// is re-read on every pass, so the window below expires it — but only on a pass, and the deck
/// takes no pass on a timer. Where every child has fallen silent AND the parent never writes again,
/// nothing invalidates the rail and the last dot stands past its window. That is the property
/// `DelegationCeiling` has had since #1090, unchanged in kind: both are read WHEN THE LIST IS
/// DERIVED, and a clock in the room's stamp would expire every memo in it on a timer, which is the
/// cost #858 and #875 exist to have removed.
enum SubagentWriting: Equatable, Sendable {
    /// Argo saw this file grow inside the window below.
    case writing
    /// It has not — including the ordinary case of a file Argo never watched grow at all. Absence
    /// of evidence, which is why it settles nothing on its own.
    case quiet

    /// `SessionLiveness.recentActivityWindowMs`, and deliberately not a second number. The question
    /// is the same one that constant was measured for — a live agent sits quiet mid-tool, so only a
    /// record touched inside this window corroborates one actively working — and a Subagent is an
    /// Agent. A figure of its own here would be a second answer to one question, drifting.
    static let growthWindowMs = SessionLiveness.recentActivityWindowMs

    /// `quiet` for a file Argo never watched grow: `lastGrewAtMs` is `nil` until a batch lands
    /// AFTER the backfill, so a child that finished before the cockpit opened dates nothing.
    static func read(lastGrewAtMs: Int?, nowMs: Int) -> SubagentWriting {
        guard let lastGrewAtMs else { return .quiet }
        return nowMs - lastGrewAtMs <= growthWindowMs ? .writing : .quiet
    }
}
