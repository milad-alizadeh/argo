import AppKit
import ArgoEngine

/// Starting an agent, and saying so when it does not start.
///
/// A refusal is surfaced in the tool's OWN words rather than swallowed. Both real ones — no
/// reachable folder, and `claude` missing from the `PATH` a Finder-launched app inherits — look
/// exactly like success otherwise: nothing happens (#361).
@MainActor
extension CockpitCoordinator {
    func spawnSession() async {
        do {
            try await hub.spawnSession()
        } catch {
            report(spawnFailure: error)
        }
    }

    /// Every agent this window started, ended. The PTY dies with the process that owns it whether
    /// or not this runs — this is what makes it happen at the moment the window closes rather than
    /// leaving agents attached to a process on its way out.
    func endOwnedSessions() {
        hub.endOwnedSessions()
    }

    private func report(spawnFailure error: any Error) {
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = "Could not start a session"
        alert.informativeText = (error as? AgentSpawnError)?.detail ?? error.localizedDescription
        alert.runModal()
    }
}
