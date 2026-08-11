import ArgoEngine
import Foundation

/// The active Project's Bindings, rolled up into the one chip.
///
/// The roll-up is honest because the action is identical either way: two stale connections are two
/// things to wait out, and naming both in the chrome buys nothing a click cannot. Per-port truth
/// exists — the Connect panel has it, with a fix per row — it just is not glanceable chrome.
///
/// The one escalation past that is the account level. A refused grant is the only failure Argo can
/// prove will not fix itself, so it is the only one that names its subject and carries a button.
enum ConnectionHealthProjection {
    static func chip(
        from reading: ConnectionHealthReading,
        asOf now: Date = Date(),
    )
        -> ConnectionChipReading? {
        let failing = reading.connections.filter { $0.health.state != .healthy }
        guard !failing.isEmpty else { return nil }
        let refused = failing.filter { $0.health.level == .account }
        guard refused.isEmpty else { return reconnect(refused) }
        return stale(failing, asOf: now)
    }

    /// Named while one identity is down, counted once two are. Naming the first of two would send
    /// the user to reconnect an Account and find the chip still lit — a grant is per identity, so
    /// two of them are two acts and the chip has to say so.
    private static func reconnect(_ refused: [PortConnection]) -> ConnectionChipReading {
        let accounts = Set(refused.map(\.account.id))
        let label = if accounts.count == 1, let one = refused.first {
            "\(one.account.provider.readableName) · \(one.account.displayName) · needs reconnect"
        } else {
            "\(accounts.count) accounts need reconnect"
        }
        return ConnectionChipReading(label: label, state: .failure, action: "Reconnect")
    }

    /// `provider · age · cause`, and the count once there is more than one. The age is what the
    /// chip is really for: the data underneath it is still rendered at full fidelity, and how old
    /// it is is the one thing that reading cannot say about itself.
    private static func stale(
        _ failing: [PortConnection],
        asOf now: Date,
    )
        -> ConnectionChipReading {
        guard failing.count == 1, let one = failing.first,
              case let .stale(cause) = one.health.state
        else {
            return ConnectionChipReading(
                label: "\(failing.count) connections stale",
                state: .attention,
                action: nil,
            )
        }
        // Absent rather than zero for a connection that never landed a read: never having heard is
        // a different fact from having heard a moment ago.
        let age = one.health.age(asOf: now).map { AgePhrase.phrase(seconds: Int($0)) }
        let parts = [one.account.provider.readableName, age, cause.readableName].compactMap(\.self)
        return ConnectionChipReading(
            label: parts.joined(separator: " · "),
            state: .attention,
            action: nil,
        )
    }
}
