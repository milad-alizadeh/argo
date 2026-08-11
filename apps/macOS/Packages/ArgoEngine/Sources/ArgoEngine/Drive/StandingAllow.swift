import Foundation

/// One tool this Session stopped asking about (#572). `CONTEXT.md`'s **Gate** is the nearest thing
/// already modelled — Argo's own policy on automating a step, `ask | auto` — and this is its
/// per-tool sibling on the Session rather than on the Delivery.
///
/// It is a value the Session PUBLISHES rather than a set the gate keeps to itself, and that is the
/// whole of what #572 asked for: the version that shipped first was a set of tool names with no
/// rendering and no way back, and a standing decision nobody can find later is not one a person
/// made carefully.
public struct StandingAllow: Sendable, Equatable, Identifiable {
    /// The CLI's own name for the tool, verbatim — the grant covers exactly the calls the prompt
    /// that made it named, and nothing that merely resembles them.
    public let toolName: String

    /// The tool IS the identity: a Session holds at most one grant per tool name, and granting the
    /// same one twice is the same standing decision, not a second one.
    public var id: String {
        toolName
    }

    public init(toolName: String) {
        self.toolName = toolName
    }
}

/// The grants a gate is holding, per claim.
///
/// Its own value rather than a dictionary reached into from the channel, because "does this tool
/// still have to ask" and "what is this Session showing the user" have to be answered off the same
/// table — the bug #572 is about is exactly those two disagreeing.
///
/// Keyed by the CLAIM and not the Session id, like everything else the gate holds: a grant made
/// before the CLI has written a record has to survive the row being re-keyed to the id it picks.
struct StandingAllowTable {
    private var granted: [SessionOwnership.ClaimID: [StandingAllow]] = [:]

    /// Whether this tool's calls go through without a prompt on this claim.
    func allows(_ toolName: String, for claim: SessionOwnership.ClaimID) -> Bool {
        granted[claim, default: []].contains { $0.toolName == toolName }
    }

    /// What this claim has standing, in the order the grants were made. The order is the reading
    /// order too — the newest grant is the one a user is most likely looking for.
    func grants(for claim: SessionOwnership.ClaimID) -> [StandingAllow] {
        granted[claim] ?? []
    }

    /// Answers whether anything changed, so a caller only republishes when there is news.
    mutating func grant(_ toolName: String, for claim: SessionOwnership.ClaimID) -> Bool {
        guard !allows(toolName, for: claim) else { return false }
        granted[claim, default: []].append(StandingAllow(toolName: toolName))
        return true
    }

    mutating func revoke(_ toolName: String, for claim: SessionOwnership.ClaimID) -> Bool {
        guard allows(toolName, for: claim) else { return false }
        granted[claim] = grants(for: claim).filter { $0.toolName != toolName }
        return true
    }

    /// The claim is over, so every grant made under it is too. A grant outliving the PTY it was
    /// made against would be a promise Argo cannot keep: managed-ness is not durable, and the gate
    /// that would have to honour the grant dies with the process.
    mutating func withdraw(_ claim: SessionOwnership.ClaimID) -> Bool {
        granted.removeValue(forKey: claim) != nil
    }
}
