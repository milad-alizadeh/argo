import Foundation

/// One tool this Session stopped asking about (#572) — the per-tool sibling of `CONTEXT.md`'s
/// **Gate**, on the Session rather than on the Delivery. Published rather than private to the gate.
public struct StandingAllow: Sendable, Equatable, Identifiable {
    /// The CLI's own name for the tool, verbatim — the grant covers exactly the calls the prompt
    /// that made it named, and nothing that merely resembles them.
    public let toolName: String

    /// The tool IS the identity: at most one grant per tool name per Session.
    public var id: String {
        toolName
    }

    public init(toolName: String) {
        self.toolName = toolName
    }
}

/// The grants a gate is holding, per claim (#572). Its own value and not a set the channel reaches
/// into: "does this tool still have to ask" and "what is this Session showing" must be answered off
/// the same table, and #572 is those two disagreeing.
///
/// Keyed by the CLAIM and not the Session id, like everything else the gate holds: a grant made
/// before the CLI has written a record has to survive the row being re-keyed to the id it picks.
struct StandingAllowTable {
    private var granted: [SessionOwnership.ClaimID: [StandingAllow]] = [:]

    /// Whether this tool's calls go through without a prompt on this claim.
    func allows(_ toolName: String, for claim: SessionOwnership.ClaimID) -> Bool {
        granted[claim, default: []].contains { $0.toolName == toolName }
    }

    /// What this claim has standing, in the order the grants were made — also the reading order.
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

    /// The claim is over, so every grant under it is too — the gate dies with the process.
    mutating func withdraw(_ claim: SessionOwnership.ClaimID) -> Bool {
        granted.removeValue(forKey: claim) != nil
    }
}
