import ArgoEngine

/// Whether Argo has watched this Subagent's OWN file grow recently enough to call the delegation
/// live (#1269).
///
/// The evidence the parent's record does not hold. A Session that delegated its children and is now
/// waiting on them writes nothing itself, so its status reads `idle` and every delegation under it
/// is indistinguishable in the record from a dead one's (#1076). Argo holds each child's own
/// transcript anyway — that is what the rail draws when the reader opens a chip (#858) — and a file
/// Argo has watched grow is DIRECT evidence that somebody is writing it.
///
/// **One-directional, exactly as `DelegationCeiling` is.** It only ever settles an `unknown` chip;
/// it never takes a `finished` away. A delegation the record closed is closed whatever a trailing
/// byte in the child's file says, and a stale one is stale — this is here to stop a gap in the
/// evidence being read as an ending, not to reopen the endings Argo has.
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
