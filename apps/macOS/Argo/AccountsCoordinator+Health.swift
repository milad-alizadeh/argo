import ArgoEngine
import ArgoUI
import Foundation

/// How the active Project's ports are reading, as the chip's own value.
///
/// Its own file because it is its own subject: the panel is a surface the user opens, and this is a
/// standing fact about the window whether or not they ever do. The two are built from the same
/// resolution — one pass over the ports answers both, so the panel and the chip can never disagree
/// about which Account a port reads through.
///
/// Two sources meet here, and the split is what keeps each honest:
///
/// - **Derived, per refresh** — a grant that has expired or gone from the keychain is visible in
///   the registries alone, so it is read off the resolution every time and never written down.
///   That is why the chip is right about the account level before anything has polled, and why it
///   goes quiet the moment the grant is obtained again.
/// - **Recorded, in the ledger** — what a read actually reported. The Work Item poll is what
///   produces these (#388); the code host's own read arrives with #260.
extension AccountsCoordinator {
    /// Point the reading at a Project, or at none. Raised on every change of active Project,
    /// because connection health is per-project truth surfaced for the active Project only: a
    /// background Project whose provider died stays silent, and you learn on switch.
    func point(at project: ProjectRecord?) async {
        self.project = project
        await refresh()
    }
}
