import AppKit
import ArgoEngine

/// Starting an agent, and saying so when it does not start. Both real refusals — no reachable
/// folder, and `claude` missing from the `PATH` a Finder-launched app inherits — look exactly like
/// success otherwise: nothing happens (#361).
@MainActor
extension CockpitCoordinator {
    /// Returns the id the roster publishes the provisional row under — the claim's own, until the
    /// CLI names a Session — so the shell can point at what it just started, and `nil` where
    /// nothing started at all.
    func spawnSession() async -> String? {
        do {
            return try await hub.spawnSession().value
        } catch let failure as AgentSpawnError {
            report(detail: failure.detail)
        } catch {
            report(detail: error.localizedDescription)
        }
        return nil
    }

    /// Continue a Session Argo can no longer steer, on the same chain (#10). Raised by selection,
    /// so it says nothing on success — the composer coming back IS the answer.
    ///
    /// A refusal is reported like a spawn's and leaves the Session exactly as it was: read-only,
    /// with no composer to type into (#546).
    func resumeSession(sessionID: String) async {
        let title = "Could not continue this session"
        do {
            try await hub.resumeSession(sessionID: sessionID)
        } catch let failure as SessionResumeError {
            report(detail: failure.detail, title: title)
        } catch let failure as AgentSpawnError {
            report(detail: failure.detail, title: title)
        } catch {
            report(detail: error.localizedDescription, title: title)
        }
    }

    /// Hand a full Session's work to a fresh one (#513): `/handoff` in its own terminal, the wait
    /// for the brief, then #412's spawn path seeded with it and the folder it was running in.
    ///
    /// Returns the fresh Session's id so the caller can put the roster on it, and `nil` when the
    /// handoff did not happen. Every refusal is reported; no Session row is published for work
    /// nobody handed over.
    func handOff(sessionID: String, issue: Int?) async -> String? {
        do {
            guard let cwd = hub.sessions.first(where: { $0.id == sessionID })?.cwd else {
                throw SessionHandoff.Failure.noFolder
            }
            return try await SessionHandoff(host: hub, root: Hub.handoffRoot)
                .run(SessionHandoff.Request(sessionID: sessionID, cwd: cwd, issue: issue))
                .sessionID
        } catch let failure as SessionHandoff.Failure {
            report(detail: failure.detail)
        } catch let failure as AgentSpawnError {
            report(detail: failure.detail)
        } catch {
            report(detail: error.localizedDescription)
        }
        return nil
    }

    /// Every agent this window started, ended.
    func endOwnedSessions() {
        hub.endOwnedSessions()
    }

    /// End them on quit as well as on window close: ⌘Q with the window still open never runs the
    /// view's `onDisappear`, leaving those PTYs to the kernel's hang-up as the process dies.
    func endOwnedSessionsOnQuit() {
        NotificationCenter.default.addObserver(
            forName: NSApplication.willTerminateNotification,
            object: nil,
            queue: .main,
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.endOwnedSessions() }
        }
    }

    /// One shape for every refusal; the sentence under the title is the tool's own.
    private func report(detail: String, title: String = "Could not start a session") {
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = title
        alert.informativeText = detail
        alert.runModal()
    }
}
