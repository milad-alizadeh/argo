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
        await spawn(.unseeded)
    }

    /// The one spawn every entry point below goes through. Each of them differs in nothing but its
    /// seed, and three copies of one `do`/`catch` was three places for a refusal to stop being
    /// reported.
    private func spawn(_ seed: SessionSeed) async -> String? {
        do {
            return try await hub.spawnSession(seed: seed).value
        } catch {
            report(detail: AgentRefusal.detail(of: error))
        }
        return nil
    }

    /// Continue a Session Argo can no longer steer, on the same chain (#10). Silent on success —
    /// the composer coming back is the answer.
    ///
    /// A refusal leaves the Session exactly as it was: read-only, with no composer (#546).
    func resumeSession(sessionID: String) async {
        do {
            try await hub.resumeSession(sessionID: sessionID)
        } catch {
            report(
                detail: AgentRefusal.detail(of: error),
                title: "Could not continue this session",
            )
        }
    }

    /// The same spawn, started ON a ticket, on the rung the Tickets room's row names (#872) and
    /// opening on the command that ticket asks for (#899).
    ///
    /// The Project's own folder: Argo cuts no branch and makes no worktree, so what makes this the
    /// ticket's Session is the seed naming it — which is also what the Tickets room reads back to
    /// draw the row as claimed.
    ///
    /// `opening` is `nil` where the ticket's labels REFUSE a command (#1182), which is the plain
    /// empty composer.
    func spawnSession(on ticket: Int, mode: SessionMode, opening: String?) async -> String? {
        await spawn(SessionSeed(opening: opening, mode: mode, ticket: ticket))
    }

    /// The same spawn in another Session's folder (#546). Seeded with that Session's cwd and
    /// nothing else: a fresh start on the same branch, not a handoff, so no brief and no prompt.
    func spawnSession(beside sessionID: String) async -> String? {
        guard let cwd = hub.sessions.first(where: { $0.id == sessionID })?.cwd else {
            report(detail: "Argo does not know which folder that Session was running in")
            return nil
        }
        return await spawn(SessionSeed(cwd: cwd))
    }

    /// Hand a full Session's work to a fresh one (#513), and say so where the reading cannot.
    ///
    /// A handoff that BEGAN reports itself in the feed and not in a modal (#1229): `handoffEnded`
    /// drops the failure into the reading of the Session it was pressed on, which is where the
    /// reader was already looking and where the plinth that ran beside it stood. Those facts are
    /// filed against the CLAIM, so a Session Argo holds none on — one whose process went while the
    /// handoff ran — has nowhere to put a row, and the alert is the only report left.
    func handOff(sessionID: String, issue: Int?) async -> String? {
        do {
            return try await hub.handOff(sessionID: sessionID, issue: issue)
        } catch {
            if !hub.reportsHandoff(of: sessionID) {
                report(detail: AgentRefusal.detail(of: error))
            }
            return nil
        }
    }

    /// Every agent this window started, ended on quit as well as on window close: ⌘Q with the
    /// window still open never runs the view's `onDisappear`, leaving those PTYs to the kernel's
    /// hang-up as the process dies.
    func endOwnedSessionsOnQuit() {
        NotificationCenter.default.addObserver(
            forName: NSApplication.willTerminateNotification,
            object: nil,
            queue: .main,
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.hub.endOwnedSessions() }
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
