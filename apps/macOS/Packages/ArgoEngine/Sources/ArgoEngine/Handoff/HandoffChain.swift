import Foundation

/// Which Session handed its work to which — the `produces` edge of a handoff, kept.
///
/// Durable owned state: an **Outcome** in `CONTEXT.md`'s sense — Session-keyed and persisted
/// (ADR-0008) — rather than a derivation Argo could take again. Nothing else on disk carries it.
///
/// A link is written in two moments. At the handoff Argo knows only the CLAIM the fresh row was
/// published under, and a claim dies with the process that issued it; the id its CLI picks arrives
/// later, when the first record appears. So a link is recorded against the claim and NAMED when the
/// binding happens, and a link that never got a name is a handoff whose fresh Session never wrote
/// a record.
public struct HandoffChain: Codable, Equatable, Sendable {
    public struct Link: Codable, Equatable, Sendable {
        /// The Session that handed its work over — the CLI's own id, which is durable.
        public let from: String
        /// The Session now carrying it, once its CLI has named one. `nil` until then, and forever
        /// for one whose agent wrote nothing.
        public var to: String?
        /// The claim the fresh row was published under. Meaningless to a later Argo; kept only so
        /// the naming has something to match on.
        public let claim: String
        public let atMs: Int
    }

    public var links: [Link] = []

    public init(links: [Link] = []) {
        self.links = links
    }

    /// The chain as the roster reads it: source id → the id of the row now carrying the work.
    ///
    /// Unnamed links are left out, and the NEWEST link wins where a Session handed off more than
    /// once.
    var resolved: [String: String] {
        links.sorted { $0.atMs < $1.atMs }.reduce(into: [:]) { found, link in
            guard let to = link.to else { return }
            found[link.from] = to
        }
    }

    mutating func record(from: String, claim: String, atMs: Int) {
        links.append(Link(from: from, to: nil, claim: claim, atMs: atMs))
    }

    /// The CLI picked an id for a claim. Answers whether that named anything here, so a caller can
    /// skip writing a file it did not change — this is asked on every observation batch.
    mutating func name(claim: String, as sessionID: String) -> Bool {
        guard let index = links.firstIndex(where: { $0.claim == claim && $0.to == nil })
        else { return false }
        links[index].to = sessionID
        return true
    }
}
