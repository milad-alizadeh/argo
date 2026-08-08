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
        } catch let failure as AgentSpawnError {
            report(detail: failure.detail)
        } catch {
            report(detail: error.localizedDescription)
        }
    }

    /// Every agent this window started, ended.
    func endOwnedSessions() {
        hub.endOwnedSessions()
    }

    /// End them on quit as well as on window close.
    ///
    /// ⌘Q with the window still open never runs the view's `onDisappear`, so without this the only
    /// thing ending those PTYs is the kernel hanging up their side of the terminal as the process
    /// dies — which is a thing that probably happens rather than a thing Argo did.
    func endOwnedSessionsOnQuit() {
        NotificationCenter.default.addObserver(
            forName: NSApplication.willTerminateNotification,
            object: nil,
            queue: .main,
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.endOwnedSessions() }
        }
    }

    private func report(detail: String) {
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = "Could not start a session"
        alert.informativeText = detail
        alert.runModal()
    }
}
