/// Who is working in a Workspace, and how Argo knows they are.
///
/// Its own value rather than two fields on the projection beside git's counts, because the tier
/// here is a claim about ONE thing: that an Agent is attached to this folder. Nothing git reported
/// about the folder is tiered by it — a dirty count is read back off git whoever is standing in it,
/// and a `direct` spanning the whole projection would be a DIRECT claim on facts Argo does not own
/// (`CONTEXT.md`, Honesty tier).
public struct WorkspaceHolders: Equatable, Sendable {
    /// How many Agents are in the folder. Zero for a worktree nobody is running in, which is an
    /// honest count and not a missing one: the listing says the worktree exists whether or not the
    /// roster has anybody in it.
    public let count: Int
    /// `direct` only where Argo chose the folder for the Agent itself — see `known(via:)`.
    public let tier: Tier

    public init(count: Int, tier: Tier) {
        self.count = count
        self.tier = tier
    }

    /// What a read straight off git knows: that the worktree is there, and nothing about who is in
    /// it. The quieter answer on both counts, until something holding the roster says otherwise.
    public static let unattributed = WorkspaceHolders(count: 0, tier: .derived)

    func counting(_ count: Int) -> WorkspaceHolders {
        WorkspaceHolders(count: count, tier: tier)
    }

    /// `direct` only for a Session Argo spawned, and only about the ATTACHMENT: Argo launched that
    /// process in that folder. `external` never was Argo's, and `orphaned` was but the record went
    /// with the process, so both are matched back on a path and both degrade down.
    func known(via provenance: SessionProvenance) -> WorkspaceHolders {
        switch provenance {
        case .managed:
            WorkspaceHolders(count: count, tier: .direct)
        case .external, .orphaned:
            WorkspaceHolders(count: count, tier: .derived)
        }
    }
}
