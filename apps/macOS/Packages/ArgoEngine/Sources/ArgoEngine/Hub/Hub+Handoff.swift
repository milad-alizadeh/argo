import Foundation

/// The Hub answering the three acts a handoff is made of.
///
/// Each is a fact the Hub already holds and nothing more: which claim owns a Session's PTY, what is
/// on disk at a path, and how to start an agent. The ORDER they go in is `SessionHandoff`'s and is
/// asserted there — this file is only the wiring.
@MainActor
extension Hub: HandoffHost {
    /// Typing at a prompt is what a Turn IS, so it goes through the driver rather than writing the
    /// PTY itself — one spelling of Return reaches the CLI, not two that can drift (#628).
    ///
    /// `false` wherever the driver refuses, which for a non-empty command means Argo owns no live
    /// PTY: an external Session, or an orphaned one whose claim outlived its own.
    public func steer(sessionID: String, typing text: String) -> Bool {
        guard (try? driver.send(text, to: sessionID)) != nil else { return false }
        // The words, kept against the claim: they are what tells THIS Turn from one the reader
        // types while it runs, when the delivery watch reports one of the two lost (#1229).
        if let claim = ownership.boundClaim(ofSessionID: sessionID) {
            claims.setHandoffPrompt(text, for: claim)
        }
        return true
    }

    /// Whatever is at the path, verbatim. Whether what is there COUNTS as a brief is the
    /// orchestration's rule and is decided there — this reads a file.
    public func brief(at path: String) -> String? {
        try? String(contentsOfFile: path, encoding: .utf8)
    }

    public func spawn(_ seed: SessionSeed) async throws -> String {
        try await spawnSession(seed: seed).value
    }

    /// The edge, recorded against the CLAIM the fresh row was published under and named later, when
    /// the fresh agent's first record gives it an id — see `HandoffLedger`.
    public func handedOff(sessionID: String, to fresh: String) {
        handoff.record(
            from: sessionID,
            claim: SessionOwnership.ClaimID(value: fresh),
            atMs: Date().epochMs,
        )
    }

    /// Filed against the CLAIM, exactly as a submitted or a lost Turn is (#1048, #682): the row is
    /// re-keyed to its CLI's own id the moment its first record lands, and a fact filed under the
    /// id it had before would be lost at the re-key. A Session with no claim is one Argo cannot
    /// type at, so there is no handoff of ours to report either way.
    public func handoffStarted(sessionID: String) {
        guard let claim = ownership.boundClaim(ofSessionID: sessionID) else { return }
        // Dropped before the prompt is typed as well as at the end below, because the end is the
        // one of the two a torn-down window can skip: last attempt's words, or its news, left
        // standing would end this one before its own Turn had been written.
        claims.forgetHandoffTurn(for: claim)
        claims.publish(handingOff: true, for: claim)
    }

    /// What the delivery watch said about the `/handoff` prompt (#682, #1229): `true` only where
    /// the composer was seen still holding it. A Session with no claim was never typed at, so there
    /// is no Turn of ours to have lost.
    public func turnWasLost(sessionID: String) -> Bool {
        claims.facts(for: ownership.boundClaim(ofSessionID: sessionID)).handoffTurnLost
    }

    /// One handoff of this Session's work, whole (#513): the folder it runs in, read off the
    /// roster, and then the three acts in `SessionHandoff`'s own order.
    ///
    /// Here rather than in the app, where it was: the app target holds the scene, the observable
    /// boxes and the AppKit panels, and a derivation there is one no test can reach (ADR-0022).
    /// What is left to the app is the one thing only it can do, which is speak out loud.
    public func handOff(sessionID: String, issue: Int?) async throws -> String {
        // The header greys its button on this same case and reads its sentence from the same
        // failure, so reaching it is a race with a folder going unreadable rather than a press.
        guard let cwd = sessions.first(where: { $0.id == sessionID })?.cwd else {
            throw SessionHandoff.Failure.noFolder
        }
        return try await SessionHandoff(host: self, root: Hub.handoffRoot)
            .run(SessionHandoff.Request(sessionID: sessionID, cwd: cwd, issue: issue))
            .sessionID
    }

    /// Whether a handoff of this Session has anywhere in the reading to report itself (#1229).
    ///
    /// Every fact a handoff files is filed against the CLAIM, so a Session Argo holds none on —
    /// an external one, or one whose process went while the handoff ran — drops no row however it
    /// ends. The app asks before it stays quiet: a failure reported nowhere is the shape this
    /// ticket is about.
    public func reportsHandoff(of sessionID: String) -> Bool {
        ownership.boundClaim(ofSessionID: sessionID) != nil
    }

    public func handoffEnded(sessionID: String, tookMs: Int, failure: String?) {
        guard let claim = ownership.boundClaim(ofSessionID: sessionID) else { return }
        claims.publish(handingOff: false, for: claim)
        // Spent, and taken back with the wait they belonged to: the sentence they produced is in
        // the row below, and either left standing would hold this claim's entry in the ledger for
        // the rest of the window (`ClaimFacts.isEmpty`).
        claims.forgetHandoffTurn(for: claim)
        if let failure {
            claims.recordHandoffFailure(
                SessionWaitSettled(wait: .handingOff, tookMs: tookMs, failure: failure),
                for: claim,
            )
        }
    }

    /// The address `HandoffScript` explains, made concrete: Argo's own per-machine data, beside the
    /// Project registry.
    public static let handoffRoot = ProjectRegistryStore.defaultFileURL
        .deletingLastPathComponent()
        .appending(path: "handoffs", directoryHint: .isDirectory)
}
